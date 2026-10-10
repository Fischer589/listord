// Local, read-only release checks. Findings identify files, never secret values.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import nextConfig from "../next.config.mjs";

assert.equal(nextConfig.images.unoptimized, true, "Global optimizer bypass is required");
const manifest = JSON.parse(readFileSync(".next/images-manifest.json", "utf8"));
assert.equal(manifest.images.unoptimized, true, "Built optimizer bypass is required");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.engines.node, "24.x");
assert.equal(process.versions.node.split(".")[0], "24", "Verify on Node 24");
const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0").filter(Boolean);
const browser = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".js")) browser.push(path);
  }
}
walk(".next/static");
const violations = [];
for (const file of [...tracked.filter(p => /\.(?:[cm]?[jt]sx?|sql|json|md|ya?ml|env)$/.test(p)), ...browser]) {
  const text = readFileSync(file, "utf8");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
      /\b(?:sk_live_|sk_test_|sb_secret_)[A-Za-z0-9_-]{20,}/.test(text) ||
      /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]{8,}@/.test(text)) violations.push(file);
  for (const jwt of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(jwt[0].split(".")[1], "base64url").toString()).role === "service_role") violations.push(file);
    } catch { /* not a JWT payload */ }
  }
}
assert.deepEqual([...new Set(violations)], [], "Potential embedded credentials; inspect privately");
for (const file of browser) {
  const text = readFileSync(file, "utf8");
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|ADMIN_SESSION_SECRET|WHATSAPP_ACCESS_TOKEN/.test(text), `Server credential reference in browser bundle: ${file}`);
}
console.log(`Security checks passed: Node 24, built optimizer bypass, ${tracked.length} repository files and ${browser.length} browser chunks scanned; no detected embedded credentials or server-secret references.`);
