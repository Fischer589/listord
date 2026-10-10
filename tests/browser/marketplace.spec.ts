import { expect, test, type Page } from "@playwright/test";
import { emptyRequest } from "../../lib/request-specification";

const id = "11111111-1111-4111-8111-111111111111";
const workerId = "22222222-2222-4222-8222-222222222222";
const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" }, timing: "Mañana a las nueve", duration: "4 horas", amount: "1500" };
const opportunity = { id, category: "limpieza", city: "Puerto Plata", specification: draft, status: "open", expires_at: "2099-10-23T12:00:00Z" };
// Synthetic browser transport fixtures. SQL/RPC authorization is tested separately;
// these cases do not establish hosted Auth, provider or database acceptance.
async function login(page: Page) {
  await page.route("**/auth/v1/**", async route => {
    const verify = route.request().url().includes("/verify");
    await route.fulfill({ json: verify ? { access_token: "fixture_access_token_not_live_123456789", refresh_token: "fixture_refresh_not_live", expires_in: 3600, token_type: "bearer", user: { id: workerId, aud: "authenticated", email: "fixture@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" } } : {} });
  });
  await page.getByLabel("Correo electrónico").fill("fixture@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
}

test("anonymous details and service/city filters precede verification", async ({ page }) => {
  await page.route("**/api/marketplace", route => route.fulfill({ json: { opportunities: [opportunity] } }));
  await page.goto("/oportunidades");
  await expect(page.getByText(/Fecha y horario: Mañana a las nueve/)).toBeVisible();
  await expect(page.getByText(/Presupuesto: RD\$1,?500/)).toBeVisible();
  await expect(page.getByRole("button", { name: "SÍ, me interesa", exact: true })).toHaveCount(0);
  await page.getByLabel("Filtrar por servicio").selectOption("cocina");
  await expect(page.getByText("No hay oportunidades con estos filtros.")).toBeVisible();
  await page.getByLabel("Filtrar por servicio").selectOption("limpieza");
  await page.getByLabel("Filtrar por ciudad").fill("Puerto");
  await expect(page.getByRole("heading", { name: "Limpieza · Puerto Plata" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("verified YES, NO and withdrawal persist honestly; contact denial has no success link", async ({ page }) => {
  let decision = "";
  await page.route("**/api/marketplace**", async route => {
    const req = route.request();
    if (req.url().includes("/contacts")) return route.fulfill({ status: 403, json: { error: "No hay un SÍ vigente autorizado." } });
    if (req.method() === "POST") { decision = req.postDataJSON().decision; return route.fulfill({ json: { saved: true } }); }
    if (req.url().includes("mine=true")) return route.fulfill({ json: { owned: [], workers: [{ id: workerId, full_name: "Perfil fixture" }], decisions: decision ? [{ opportunity_id: id, worker_id: workerId, decision, marketplace_opportunities: opportunity }] : [] } });
    return route.fulfill({ json: { opportunities: [opportunity] } });
  });
  await page.goto("/oportunidades"); await login(page);
  await page.getByLabel("Mi perfil verificado").selectOption(workerId);
  await page.getByRole("button", { name: "SÍ, me interesa", exact: true }).click();
  await expect(page.getByText("SÍ, me interesa", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "NO, no me interesa", exact: true }).click();
  await expect(page.getByText("NO, no me interesa", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Abrir contacto autorizado" }).click();
  await expect(page.getByText("No hay un SÍ vigente autorizado.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Contactar a/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Retirar respuesta guardada" }).click();
  await expect(page.getByText("Respuesta retirada", { exact: true })).toBeVisible();
  expect(decision).toBe("withdrawn");
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => k.includes("auth-token")))).toBe(false);
});

test("owner shortlist and closing preserve terms; gated Express never claims payment", async ({ page }) => {
  let status = "open";
  await page.route("**/api/marketplace**", async route => {
    const req = route.request();
    if (req.url().includes("/contacts")) return route.fulfill({ json: { contacts: [{ name: "Perfil fixture", url: "https://wa.me/18090000111?text=fixture" }] } });
    if (req.method() === "POST") { status = req.postDataJSON().status; return route.fulfill({ json: { saved: true } }); }
    if (req.url().includes("mine=true")) return route.fulfill({ json: { owned: [{ marketplace_opportunities: { ...opportunity, status } }], workers: [], decisions: [] } });
    return route.fulfill({ json: { opportunities: [] } });
  });
  await page.goto("/oportunidades"); await login(page);
  await page.getByRole("button", { name: "Ver respuestas SÍ" }).click();
  await expect(page.getByRole("link", { name: "Contactar a Perfil fixture por WhatsApp" })).toHaveAttribute("href", /wa.me/);
  await page.getByLabel(/Entiendo los términos/).check();
  await page.getByRole("button", { name: "Verificar perfiles para Express" }).click();
  await expect(page.getByRole("button", { name: "Solicitar pago con tarjeta RD$299" })).toBeDisabled();
  await expect(page.getByText(/Express no está disponible/)).toBeVisible();
  await page.getByRole("button", { name: "Cerrar solicitud" }).click();
  await expect(page.getByRole("heading", { name: "Puerto Plata · Cerrada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar solicitud" })).toBeDisabled();
});

test("marketplace API refuses forged identity and cross-origin mutation; Express remains gated", async ({ request }) => {
  const denied = await request.post("/api/marketplace", { data: { action: "decide", id, workerId, decision: "interested", actor: workerId } });
  expect(denied.status()).toBe(401);
  const crossOrigin = await request.post("/api/marketplace", { headers: { Origin: "https://evil.example.test" }, data: { action: "create" } });
  expect(crossOrigin.status()).toBe(400);
  expect((await request.post("/api/express", { data: { id, channel: "stripe" } })).status()).toBe(503);
});

test("verified session survives request reuse and reload; sign-out removes tab credentials", async ({ page }) => {
  await page.route("**/api/marketplace**", route => route.fulfill({ json: route.request().url().includes("mine=true") ? { owned: [{ marketplace_opportunities: opportunity }], workers: [], decisions: [] } : { opportunities: [] } }));
  await page.goto("/oportunidades"); await login(page);
  await page.getByRole("button", { name: "Reutilizar detalles" }).click();
  await expect(page).toHaveURL(/\/solicitar$/);
  await expect(page.getByRole("heading", { name: "Así se verá tu solicitud." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await expect(page.getByText(/Fecha y horario: Mañana a las nueve/)).toBeVisible();
  await page.goto("/oportunidades");
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("listord-marketplace-session-v1"))).toBeNull();
});
