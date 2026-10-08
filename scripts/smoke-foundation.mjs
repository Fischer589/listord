// Run against `npm run start -- --hostname 127.0.0.1 --port 3187` after build.
// Intentionally localhost-only; never send probe headers to production.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = "http://127.0.0.1:3187";
for (const path of ["/", "/categorias/limpiadora", "/trabajadores/registro", "/empleadores", "/trabajadores/recuperar"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  console.log(`${path}: 200`);
}

for (const path of ["/admin/workers", "/admin/dashboard", "/admin/employer-requests", "/admin/employer-payments"]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.equal(response.status, 307, path);
  assert.ok(response.headers.get("location")?.includes("/admin/login"));

  const bypass = await fetch(base + path, {
    redirect: "manual",
    headers: { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" }
  });
  if (bypass.status === 307) {
    assert.ok(bypass.headers.get("location")?.includes("/admin/login"));
  } else {
    // Next can flush the shared layout before a server component redirects.
    assert.equal(bypass.status, 200);
    const body = await bypass.text();
    assert.match(body, /<meta[^>]+http-equiv="refresh"[^>]+url=\/admin\/login/);
    assert.doesNotMatch(body, /name="(?:worker_id|request_id)"/);
  }
  console.log(`${path}: login required, including middleware-bypass probe`);
}

const recovery = await fetch(base + "/trabajadores/editar?whatsapp=18090000999");
assert.equal(recovery.status, 200);
const html = await recovery.text();
assert.ok(html.includes("Solicitar recuperación segura"));
assert.ok(!html.includes("Abrir enlace de edicion"));
console.log("Phone-only recovery: support flow, no edit link");

const image = await fetch(base + "/_next/image?url=%2Flogo.png&w=640&q=75");
assert.equal(image.status, 404);
const manifest = JSON.parse(await readFile(new URL("../.next/images-manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.images.unoptimized, true);
console.log("Image safeguard: enabled in manifest; optimizer endpoint returns 404");
