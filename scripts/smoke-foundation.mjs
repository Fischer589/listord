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

const legacyContact = await fetch(base + "/contacto/22222222-2222-4222-8222-222222222222", { redirect: "manual" });
if (legacyContact.status === 307) {
  assert.equal(legacyContact.headers.get("location"), "/trabajador/22222222-2222-4222-8222-222222222222");
} else {
  assert.equal(legacyContact.status, 200);
  assert.match(await legacyContact.text(), /http-equiv="refresh"[^>]+url=\/trabajador\/22222222-2222-4222-8222-222222222222/);
}
const registrationSuccess = await fetch(base + "/trabajadores/registro-exitoso");
assert.equal(registrationSuccess.status, 200);
const registrationSuccessHtml = await registrationSuccess.text();
assert.match(registrationSuccessHtml, /Revisaremos tu registro antes de hacerlo visible/);
assert.doesNotMatch(registrationSuccessHtml, /planes de visibilidad|RD\$199\/mes|ya está visible/i);
console.log("Legacy contact route opens the free profile; registration waits for approval without paid promotion");

for (const path of ["/admin/workers", "/admin/dashboard", "/admin/employer-requests", "/admin/employer-payments", "/admin/marketplace", "/api/admin/marketplace", "/api/admin/express"]) {
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
const recoveryContact = await fetch(base + "/trabajadores/recuperar?whatsapp=8095550100");
assert.match(await recoveryContact.text(), /wa\.me\/12675160983/);
const businessContact = await fetch(base + "/soluciones-empresariales");
assert.match(await businessContact.text(), /wa\.me\/12675160983/);
assert.match(await readFile(new URL("../netlify.toml", import.meta.url), "utf8"), /NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE = "12675160983"/);
console.log("Business support links and Netlify production number agree");

const exposedLink = await fetch(base + "/trabajadores/editar?token=22222222-2222-4222-8222-222222222222");
const exposedHtml = await exposedLink.text();
assert.match(exposedHtml, /suspendida/);
assert.doesNotMatch(exposedHtml, /name="edit_token"/);
for (const route of ["checkout", "worker-checkout", "boost-checkout", "employer-deposit-checkout", "contact-credits-checkout"]) {
  const response = await fetch(`${base}/api/stripe/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(response.status, route === "checkout" ? 410 : 503, route);
}
const renewal = await fetch(`${base}/api/workers/availability`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
assert.equal(renewal.status, 400);
const outcome = await fetch(`${base}/resultados/empleador/22222222-2222-4222-8222-222222222222`);
assert.match(await outcome.text(), /No se ha registrado ninguna respuesta/);
console.log("Containment: legacy edit links and new checkout disabled; availability requires a private key; outcomes report no saved response");

const image = await fetch(base + "/_next/image?url=%2Flogo.png&w=640&q=75");
assert.equal(image.status, 404);
const manifest = JSON.parse(await readFile(new URL("../.next/images-manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.images.unoptimized, true);
console.log("Image safeguard: enabled in manifest; optimizer endpoint returns 404");
for (const width of [640, 3840]) {
  const response = await fetch(`${base}/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-fixture&w=${width}&q=75`);
  assert.equal(response.status, 404);
}
console.log("Direct remote optimizer probes: 404 at both widths");
