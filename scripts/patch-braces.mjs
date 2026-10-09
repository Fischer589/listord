// Reproducible local security mitigation. Never changes package name/version or
// suppresses npm audit. Unknown upstream bytes fail closed for manual review.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guard = readFileSync(new URL("./security/braces-depth-guard.cjs", import.meta.url), "utf8");
const sha256 = text => createHash("sha256").update(text).digest("hex");
const specs = {
  "parse.js": {
    hash: "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310",
    transform: text => text.replace("const stringify = require('./stringify');", "const stringify = require('./stringify');\nconst { assertStackDepth } = require('./listord-depth-guard');")
      .replaceAll("      stack.push(block);", "      assertStackDepth(stack.length);\n      stack.push(block);")
  },
  "compile.js": {
    hash: "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f",
    transform: text => text.replace("const compile = (ast, options = {}) => {", "const { assertAstDepth } = require('./listord-depth-guard');\n\nconst compile = (ast, options = {}) => {\n  assertAstDepth(ast);")
  },
  "expand.js": {
    hash: "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7",
    transform: text => text.replace("const expand = (ast, options = {}) => {", "const { assertAstDepth } = require('./listord-depth-guard');\n\nconst expand = (ast, options = {}) => {\n  assertAstDepth(ast);")
  },
  "stringify.js": {
    hash: "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a",
    transform: text => text.replace("module.exports = (ast, options = {}) => {", "const { assertAstDepth } = require('./listord-depth-guard');\n\nmodule.exports = (ast, options = {}) => {\n  assertAstDepth(ast);")
  }
};

// Remove only this exact patch to verify the untouched upstream digest. This also
// makes reinstall and repeated execution deterministic without storing a fork.
function original(text) {
  return text.replace("\nconst { assertStackDepth } = require('./listord-depth-guard');", "")
    .replaceAll("      assertStackDepth(stack.length);\n", "")
    .replace("const { assertAstDepth } = require('./listord-depth-guard');\n\n", "")
    .replace("  assertAstDepth(ast);\n", "");
}

export function patchBracesAt(directory, checkOnly = false) {
  const pkg = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
  if (pkg.name !== "braces" || pkg.version !== "3.0.3") throw new Error("Unexpected braces version: review mitigation before proceeding");
  const changes = [];
  for (const [file, spec] of Object.entries(specs)) {
    const path = resolve(directory, "lib", file);
    const current = readFileSync(path, "utf8");
    const upstream = original(current);
    if (sha256(upstream) !== spec.hash) throw new Error(`Unexpected braces source: ${file}`);
    const patched = spec.transform(upstream);
    if (current !== upstream && current !== patched) throw new Error(`Partial or changed braces patch: ${file}`);
    if (checkOnly && current !== patched) throw new Error(`Missing braces guard: ${file}; run npm install with lifecycle scripts enabled`);
    if (current !== patched) changes.push([path, patched]);
  }
  const guardPath = resolve(directory, "lib/listord-depth-guard.js");
  if (checkOnly && (!existsSync(guardPath) || readFileSync(guardPath, "utf8") !== guard)) throw new Error("Missing or changed braces depth guard");
  // Verify every target before any writes. A partial interrupted patch blocks all
  // build/lint/test entry points until the idempotent installer is run again.
  if (!checkOnly) {
    writeFileSync(guardPath, guard);
    for (const [path, content] of changes) writeFileSync(path, content);
  }
}

export function patchInstalledBraces(checkOnly = false) {
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const paths = Object.keys(lock.packages).filter(path => /(?:^|\/)node_modules\/braces$/.test(path));
  const installed = paths.filter(path => existsSync(resolve(root, path)));
  for (const path of installed) {
    const absolute = realpathSync(resolve(root, path));
    if (!absolute.startsWith(resolve(root, "node_modules") + sep)) throw new Error("Braces dependency resolves outside node_modules");
    patchBracesAt(absolute, checkOnly);
  }
  return installed.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checkOnly = process.argv.includes("--check");
  const count = patchInstalledBraces(checkOnly);
  console.log(`Braces local depth guard ${checkOnly ? "verified" : "applied"} to ${count} installed copy/copies. Upstream npm audit remains visible.`);
}
