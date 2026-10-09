import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { patchBracesAt, patchInstalledBraces } from "../scripts/patch-braces.mjs";

const require = createRequire(import.meta.url);
const braces = require("braces");
const guarded = error => error instanceof SyntaxError && error.code === "LISTORD_BRACES_LIMIT";

test("braces mitigation preserves normal globs, escaping, numeric ranges and nested alternatives", () => {
  assert.deepEqual(braces.expand("app/**/*.{ts,tsx}"), ["app/**/*.ts", "app/**/*.tsx"]);
  assert.deepEqual(braces.expand("file-{1..3}"), ["file-1", "file-2", "file-3"]);
  assert.deepEqual(braces.expand("{a,{b,c}}"), ["a", "b", "c"]);
  assert.equal(braces.compile("file-{a,b}"), "file-(a|b)");
  assert.equal(braces.stringify(braces.parse("file-{a,b}")), "file-{a,b}");
  assert.deepEqual(braces.expand("\\{a,b\\}"), ["{a,b}"]);
  const nested = "{".repeat(64) + "a,b" + "}".repeat(64);
  assert.doesNotThrow(() => braces.compile(nested));
});

test("all string entry points reject sub-character-limit deep braces and parentheses before recursion", () => {
  for (const pattern of ["{".repeat(4000) + "a,b" + "}".repeat(4000), "(".repeat(4000) + "a" + ")".repeat(4000), "{".repeat(200), "{(".repeat(150) + "a,b" + ")}".repeat(150)]) {
    assert.ok(pattern.length < 10000);
    for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(pattern), guarded);
      assert.throws(() => operation(pattern, { maxDepth: Infinity, maxLength: Infinity, rangeLimit: false }), guarded);
    }
  }
});

test("direct AST/library entry points cannot bypass guards with excessive depth or node cycles", () => {
  const root = { type: "root", nodes: [] };
  let parent = root;
  for (let i = 0; i < 4000; i++) { const child = { type: "brace", nodes: [] }; parent.nodes.push(child); parent = child; }
  const cyclic = { type: "root", nodes: [] }; cyclic.nodes.push(cyclic);
  for (const method of ["compile", "expand", "stringify"]) {
    for (const ast of [root, cyclic]) {
      assert.throws(() => braces[method](ast), guarded);
      assert.throws(() => require(`braces/lib/${method}`)(ast), guarded);
    }
  }
});

test("Tailwind/ESLint glob dependency consumers resolve guarded braces", () => {
  assert.equal(patchInstalledBraces(true), 1);
  const attack = "{".repeat(4000) + "a,b" + "}".repeat(4000);
  const micromatch = require("micromatch");
  assert.throws(() => micromatch.braceExpand(attack), guarded);
  assert.throws(() => require("fast-glob").generateTasks([attack]), guarded);
  assert.deepEqual(micromatch(["app/page.tsx", "docs/readme.md"], ["app/**/*.{ts,tsx}"]), ["app/page.tsx"]);
  for (const pkg of ["micromatch", "chokidar"]) {
    const consumer = createRequire(require.resolve(pkg));
    assert.equal(consumer.resolve("braces"), require.resolve("braces"));
  }
});

test("deep input is safely rejected in a constrained-stack subprocess", () => {
  const result = spawnSync(process.execPath, ["--stack-size=512", "-e", `
    const braces = require('braces');
    const pattern = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
    for (const operation of [braces.compile, braces.expand]) {
      try { operation(pattern); process.exit(2); }
      catch (error) { if (error.code !== 'LISTORD_BRACES_LIMIT') process.exit(3); }
    }
  `], { cwd: process.cwd(), timeout: 5000, encoding: "utf8" });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("patch verification is idempotent and fails closed on changed bytes/version or missing guard", () => {
  const directory = mkdtempSync(join(tmpdir(), "listord-braces-verification-"));
  try {
    cpSync(dirname(require.resolve("braces/package.json")), directory, { recursive: true });
    assert.doesNotThrow(() => patchBracesAt(directory, true));
    assert.doesNotThrow(() => patchBracesAt(directory));
    const path = join(directory, "lib/compile.js");
    const original = readFileSync(path, "utf8");
    writeFileSync(path, original + "\n// unexpected source change\n");
    assert.throws(() => patchBracesAt(directory), /Unexpected braces source/);
    writeFileSync(path, original);
    const guardPath = join(directory, "lib/listord-depth-guard.js");
    const originalGuard = readFileSync(guardPath, "utf8");
    writeFileSync(guardPath, "module.exports = {};");
    assert.throws(() => patchBracesAt(directory, true), /Missing or changed/);
    writeFileSync(guardPath, originalGuard);
    const packagePath = join(directory, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")); pkg.version = "3.0.4";
    writeFileSync(packagePath, JSON.stringify(pkg));
    assert.throws(() => patchBracesAt(directory), /Unexpected braces version/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
