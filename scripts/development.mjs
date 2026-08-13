/** Coordinate repeatable local development commands from the repository root. */
import { execFileSync, spawn } from "node:child_process";
import console from "node:console";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process, { loadEnvFile } from "node:process";
import { setTimeout } from "node:timers";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const localRuntimeDirectory = path.join(repositoryRoot, ".pantaetl");
const stackStatePath = path.join(localRuntimeDirectory, "local-stack.json");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const docker = process.platform === "win32" ? "docker.exe" : "docker";

const services = [
  { name: "web", arguments: ["web:dev"] },
  { name: "scheduler", arguments: ["scheduler:dev"] },
  { name: "garbage-collector", arguments: ["garbage-collector:dev"] },
  { name: "worker", arguments: ["worker:dev"] },
];

/** Run a command to completion while preserving its interactive output. */
function run(command, arguments_) {
  const displayCommand = [command, ...arguments_].join(" ");
  console.log(`\n$ ${displayCommand}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${displayCommand} ${signal ? `was stopped by ${signal}` : `exited with ${code}`}.`,
        ),
      );
    });
  });
}

/** Return whether a process ID belongs to an active local-stack supervisor. */
function isOwnedSupervisor(supervisorPid) {
  if (!Number.isInteger(supervisorPid) || supervisorPid <= 0) {
    return false;
  }

  try {
    process.kill(supervisorPid, 0);
  } catch {
    return false;
  }

  if (process.platform === "win32") {
    return true;
  }

  try {
    const command = execFileSync("ps", ["-p", String(supervisorPid), "-o", "command="], {
      encoding: "utf8",
    });
    return command.includes("scripts/development.mjs stack-up");
  } catch {
    return false;
  }
}

/** Read the state file written by the active local-stack supervisor. */
async function readStackState() {
  try {
    const contents = await readFile(stackStatePath, "utf8");
    const state = JSON.parse(contents);

    if (state.repositoryRoot !== repositoryRoot) {
      return undefined;
    }

    return state;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

/** Remove only the repository-local process state file. */
async function removeStackState() {
  await rm(stackStatePath, { force: true });
}

/** Wait until the supervisor has exited or the supplied timeout elapses. */
async function waitForSupervisorExit(supervisorPid, timeoutMilliseconds = 10_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (isOwnedSupervisor(supervisorPid) && Date.now() < deadline) {
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return !isOwnedSupervisor(supervisorPid);
}

/** Require the ignored local environment and its database URL before using PostgreSQL. */
async function requireLocalDatabaseEnvironment() {
  const environmentPath = path.join(repositoryRoot, ".env");

  try {
    await access(environmentPath, constants.R_OK);
  } catch {
    throw new Error("Missing .env. Copy .env.example to .env before starting the local stack.");
  }

  loadEnvFile(environmentPath);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Set it in .env before starting the local stack.");
  }
}

/** Prefix a service output stream so combined logs remain easy to scan. */
function prefixOutput(serviceName, stream) {
  let pending = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    const lines = `${pending}${chunk}`.split(/\r?\n/);
    pending = lines.pop() ?? "";

    for (const line of lines) {
      if (line) {
        console.log(`[${serviceName}] ${line}`);
      }
    }
  });
  stream.on("end", () => {
    if (pending) {
      console.log(`[${serviceName}] ${pending}`);
    }
  });
}

/** Start a local service and route its output through a labelled combined log. */
function startService(service) {
  const child = spawn(pnpm, service.arguments, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!child.stdout || !child.stderr) {
    throw new Error(`Unable to capture output for ${service.name}.`);
  }

  prefixOutput(service.name, child.stdout);
  prefixOutput(service.name, child.stderr);
  return child;
}

/** Stop a child process gracefully, escalating only if it does not exit promptly. */
async function stopService(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
  });
  child.kill("SIGTERM");

  const stoppedGracefully = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => {
      setTimeout(() => resolve(false), 10_000);
    }),
  ]);

  if (!stoppedGracefully && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

/** Build shared packages in dependency order for local service entry points. */
async function buildPackages() {
  await run(pnpm, ["packages:build"]);
}

/** Generate all committed language and route artifacts. */
async function generateArtifacts() {
  await run(pnpm, ["--filter", "@pantaetl/contracts", "generate:types"]);
  await run("uv", ["run", "python", "scripts/generate_python_contract_models.py"]);
  await buildPackages();
  await run(pnpm, ["web:build"]);
}

/** Verify generated cross-language contract artifacts without writing repository files. */
async function checkGeneratedArtifacts() {
  await run(pnpm, ["--filter", "@pantaetl/contracts", "check:types"]);
  await run("uv", ["run", "python", "scripts/check_python_contract_models.py"]);
}

/** Start Docker PostgreSQL, migrate it, then supervise all local services. */
async function startStack() {
  await requireLocalDatabaseEnvironment();

  const priorState = await readStackState();
  if (priorState && isOwnedSupervisor(priorState.supervisorPid)) {
    throw new Error("The local stack is already running. Use pnpm stack:status or pnpm stack:down.");
  }
  if (priorState) {
    await removeStackState();
  }

  await run(docker, ["compose", "up", "-d", "--wait", "postgres"]);
  await checkGeneratedArtifacts();
  await buildPackages();
  try {
    await run(pnpm, ["--filter", "@pantaetl/database", "migrate:apply"]);
  } catch (error) {
    throw new Error(
      "Database migrations failed. Inspect the existing local database before retrying; pnpm stack:reset is available only when its data can be discarded.",
      { cause: error },
    );
  }

  const children = services.map(startService);
  await mkdir(localRuntimeDirectory, { recursive: true });
  await writeFile(
    stackStatePath,
    `${JSON.stringify(
      {
        repositoryRoot,
        supervisorPid: process.pid,
        startedAt: new Date().toISOString(),
        services: children.map((child, index) => ({
          name: services[index].name,
          pid: child.pid,
        })),
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  console.log("\nLocal stack is running. Press Ctrl+C to stop services; PostgreSQL remains available.");
  console.log("Use pnpm stack:down to stop PostgreSQL too.\n");

  let stopping = false;
  const shutdown = async (exitCode) => {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log("\nStopping local services...");
    await Promise.all(children.map(stopService));
    await removeStackState();
    console.log("Local services stopped. PostgreSQL is still running; use pnpm stack:down to stop it.");
    process.exit(exitCode);
  };

  for (const [index, child] of children.entries()) {
    child.once("exit", (code, signal) => {
      if (!stopping) {
        console.error(
          `[${services[index].name}] stopped unexpectedly ${
            signal ? `(${signal})` : `(exit ${code ?? 1})`
          }.`,
        );
        void shutdown(code ?? 1);
      }
    });
  }

  process.once("SIGINT", () => {
    void shutdown(0);
  });
  process.once("SIGTERM", () => {
    void shutdown(0);
  });

  await new Promise(() => {});
}

/** Show both the supervisor state and the Docker-managed PostgreSQL status. */
async function showStackStatus() {
  const state = await readStackState();
  const localServicesRunning = Boolean(state && isOwnedSupervisor(state.supervisorPid));
  console.log(`Local services: ${localServicesRunning ? "running" : "stopped"}`);

  if (state && !localServicesRunning) {
    console.log("Ignoring stale local-stack state.");
  }

  await run(docker, ["compose", "ps"]);
}

/** Stop the owned supervisor, then stop only the Compose PostgreSQL service without deleting data. */
async function stopStack() {
  const state = await readStackState();
  if (state && isOwnedSupervisor(state.supervisorPid)) {
    console.log("Stopping local service supervisor...");
    process.kill(state.supervisorPid, "SIGTERM");

    if (!(await waitForSupervisorExit(state.supervisorPid))) {
      throw new Error("The local service supervisor did not stop within 10 seconds.");
    }
  }

  await removeStackState();
  await run(docker, ["compose", "stop", "postgres"]);
}

/** Remove the Compose PostgreSQL data volume after the local services are stopped. */
async function resetStack() {
  const state = await readStackState();
  if (state && isOwnedSupervisor(state.supervisorPid)) {
    throw new Error("Stop the local services with pnpm stack:down before resetting local data.");
  }

  await removeStackState();
  await run(docker, ["compose", "down", "--volumes", "--remove-orphans"]);
}

/** Run the requested development command. */
async function main() {
  const command = process.argv[2];

  switch (command) {
    case "setup":
      await run(pnpm, ["install", "--frozen-lockfile"]);
      await run("uv", ["sync", "--frozen"]);
      return;
    case "generate":
      await generateArtifacts();
      return;
    case "generate-check":
      await checkGeneratedArtifacts();
      return;
    case "migrate":
      await requireLocalDatabaseEnvironment();
      await run(pnpm, ["--filter", "@pantaetl/database", "migrate:apply"]);
      return;
    case "stack-up":
      await startStack();
      return;
    case "stack-status":
      await showStackStatus();
      return;
    case "stack-down":
      await stopStack();
      return;
    case "stack-reset":
      await resetStack();
      return;
    default:
      throw new Error(
        "Use one of: setup, generate, generate-check, migrate, stack-up, stack-status, stack-down, stack-reset.",
      );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
