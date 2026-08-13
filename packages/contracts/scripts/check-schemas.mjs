import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const generatedPath = "schemas/generated";

/** Run Git with generated-schema paths relative to the repository root. */
function runGit(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

try {
  runGit(["diff", "--exit-code", "--", generatedPath]);
} catch {
  throw new Error("Generated JSON Schemas are stale. Run pnpm generate:schemas.");
}

const untrackedFiles = runGit([
  "ls-files",
  "--others",
  "--exclude-standard",
  "--",
  generatedPath,
]).trim();

if (untrackedFiles) {
  throw new Error("Generated JSON Schemas must be committed.");
}
