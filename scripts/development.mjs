/** Coordinate repeatable local development commands from the repository root. */
import { execFileSync, spawn } from "node:child_process";
import console from "node:console";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:net";
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
  { name: "web", arguments: ["web:dev"], port: 3000 },
  { name: "scheduler", arguments: ["scheduler:dev"], port: 3010 },
  { name: "garbage-collector", arguments: ["garbage-collector:dev"], port: 3011 },
  { name: "worker", arguments: ["worker:dev"], port: 3020 },
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

/** Stop an owned service supervisor while preserving Docker PostgreSQL and its data. */
async function stopOwnedSupervisor(supervisorPid) {
  console.log("Restarting local services...");
  process.kill(supervisorPid, "SIGTERM");

  if (!(await waitForSupervisorExit(supervisorPid))) {
    throw new Error("The local service supervisor did not stop within 10 seconds.");
  }
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
    detached: process.platform !== "win32",
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

/** Fail before startup when an external process already owns a local service port. */
async function ensureServicePortAvailable(service) {
  await new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", (error) => {
      if ("code" in error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${service.port} for ${service.name} is already in use. Stop the existing process before starting the local stack.`,
          ),
        );
        return;
      }

      reject(error);
    });
    server.listen(service.port, "127.0.0.1", () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });
}

/** Send a signal to the detached process group that owns a local service. */
function signalService(child, signal) {
  if (process.platform === "win32" || child.pid === undefined) {
    child.kill(signal);
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH")) {
      throw error;
    }
  }
}

/** Return whether the detached process group for a local service is still alive. */
function isServiceRunning(child) {
  if (process.platform === "win32" || child.pid === undefined) {
    return child.exitCode === null && child.signalCode === null;
  }

  try {
    process.kill(-child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Wait for all processes in a local service group to exit. */
async function waitForServiceExit(child, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (isServiceRunning(child) && Date.now() < deadline) {
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return !isServiceRunning(child);
}

/** Stop a child process gracefully, escalating only if it does not exit promptly. */
async function stopService(child) {
  if (!isServiceRunning(child)) {
    return;
  }

  signalService(child, "SIGTERM");
  if (!(await waitForServiceExit(child, 10_000))) {
    signalService(child, "SIGKILL");
    await waitForServiceExit(child, 1_000);
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
    await stopOwnedSupervisor(priorState.supervisorPid);
  }
  if (priorState) {
    await removeStackState();
  }

  await Promise.all(services.map(ensureServicePortAvailable));

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
  console.log("Run pnpm stack:up to restart services or pnpm stack:reset for a fresh local stack.\n");

  let stopping = false;
  const shutdown = async (exitCode) => {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log("\nStopping local services...");
    await Promise.all(children.map(stopService));
    await removeStackState();
    console.log("Local services stopped. PostgreSQL remains available for the next pnpm stack:up.");
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

/** Remove Compose volumes, then immediately build and start a fresh local stack. */
async function resetStack() {
  await requireLocalDatabaseEnvironment();

  const state = await readStackState();
  if (state && isOwnedSupervisor(state.supervisorPid)) {
    console.log("Stopping local services for reset...");
    process.kill(state.supervisorPid, "SIGTERM");

    if (!(await waitForSupervisorExit(state.supervisorPid))) {
      throw new Error("The local service supervisor did not stop within 10 seconds.");
    }
  }

  await removeStackState();
  await run(docker, ["compose", "down", "--volumes", "--remove-orphans"]);
  await startStack();
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
    case "stack-reset":
      await resetStack();
      return;
    default:
      throw new Error(
        "Use one of: setup, generate, generate-check, migrate, stack-up, stack-status, stack-reset.",
      );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
