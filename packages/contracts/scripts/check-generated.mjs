import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const generatedTypePathspec = ":(glob)packages/contracts/src/generated/**/*.ts";

/** Run Git with generated TypeScript paths relative to the repository root. */
function runGit(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

try {
  runGit(["diff", "--exit-code", "--", generatedTypePathspec]);
} catch {
  throw new Error("Generated TypeScript contract types are stale. Run pnpm generate:types.");
}

const untrackedFiles = runGit([
  "ls-files",
  "--others",
  "--exclude-standard",
  "--",
  generatedTypePathspec,
]).trim();

if (untrackedFiles) {
  throw new Error("Generated TypeScript contract types must be committed.");
}
