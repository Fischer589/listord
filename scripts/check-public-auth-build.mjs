import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
assert.ok(url && anonKey, "Missing public Supabase build variables");
assert.equal(new URL(url).protocol, "https:", "Public Supabase URL must use HTTPS");

let hasUrl = false;
let hasKey = false;
function inspect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) inspect(path);
    else if (entry.name.endsWith(".js")) {
      const source = readFileSync(path, "utf8");
      hasUrl ||= source.includes(url);
      hasKey ||= source.includes(anonKey);
    }
  }
}
inspect(".next/static/chunks");
assert.ok(hasUrl && hasKey, "Public Supabase configuration missing from browser bundle");
console.log("Public Supabase Auth configuration verified in browser bundle.");
