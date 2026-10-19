import { expect, test, type Page } from "@playwright/test";
import { emptyRequest } from "../../lib/request-specification";

const id = "11111111-1111-4111-8111-111111111111";
const workerId = "22222222-2222-4222-8222-222222222222";
const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" }, timing: "Mañana a las nueve", duration: "4 horas", amount: "1500" };
const opportunity = { id, category: "limpieza", city: "Puerto Plata", scope: "Pisos y baños", specification: draft,
  timing_note: draft.timing, duration_note: draft.duration, compensation_kind: "budget", compensation_min: 1500,
  compensation_unit: "task", status: "open", moderation_status: "approved", expires_at: "2099-10-23T12:00:00Z" };

// Browser transport fixtures are separate from hosted Auth and database acceptance.
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

test("public cards show real terms and filters before sign-in, without exposing contacts", async ({ page }) => {
  await page.route("**/api/marketplace", route => route.fulfill({ json: { opportunities: [opportunity] } }));
  await page.goto("/oportunidades");
  const card = page.locator(".opportunity-card");
  await expect(card.getByRole("heading", { name: "Limpieza" })).toBeVisible();
  await expect(card.getByText("Presupuesto: RD$1,500 por trabajo", { exact: true })).toBeVisible();
  await expect(card.getByText("Horario: Mañana a las nueve", { exact: true })).toBeVisible();
  await expect(card.getByText(/Pisos y baños/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Me interesa" })).toBeVisible();
  await expect(page.getByText("18090000111")).toHaveCount(0);
  await page.getByLabel("Servicio").selectOption("cocina");
  await expect(page.getByText("No hay oportunidades con estos filtros.")).toBeVisible();
  await page.getByLabel("Servicio").selectOption("limpieza");
  await page.getByLabel("Ciudad").fill("Puerto");
  await expect(page.getByRole("heading", { name: "Limpieza" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("featured opportunity is visibly labeled and ordinary worker interest stays free", async ({ page }) => {
  await page.route("**/api/marketplace", route => route.fulfill({ json: { opportunities: [
    { ...opportunity, id: workerId, featured: true }, { ...opportunity, featured: false }
  ] } }));
  await page.goto("/oportunidades");
  const cards = page.locator(".opportunity-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByText("Destacada", { exact: true })).toBeVisible();
  await expect(cards.last().getByText("Oportunidad abierta", { exact: true })).toBeVisible();
  await expect(page.getByText(/Explora gratis y confirma los términos/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("only approved active employer listings show the one-time featured purchase control", async ({ page }) => {
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } }));
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => route.fulfill({ json: {
    owned: [
      { opportunity_id: id, marketplace_opportunities: opportunity },
      { opportunity_id: workerId, marketplace_opportunities: { ...opportunity, id: workerId, status: "draft", moderation_status: "pending" } }
    ], workers: [], decisions: [], applicants: [], featured: [], featuredCheckoutAvailable: true
  } }));
  await page.goto("/empleadores/mi-cuenta"); await login(page);
  await expect(page.getByRole("button", { name: "Destacar por RD$149 · 7 días" })).toHaveCount(1);
});

test("a listing too close to expiry cannot offer an incomplete featured term", async ({ page }) => {
  const expiresSoon = new Date(Date.now() + 7 * 86400_000 + 31 * 60_000).toISOString();
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } }));
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => route.fulfill({ json: {
    owned: [{ opportunity_id: id, marketplace_opportunities: { ...opportunity, expires_at: expiresSoon } }],
    workers: [], decisions: [], applicants: [], featured: [], featuredCheckoutAvailable: true
  } }));
  await page.goto("/empleadores/mi-cuenta"); await login(page);
  await expect(page.getByText("Esta publicación vence demasiado pronto para ofrecer siete días destacados completos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Destacar por RD$149 · 7 días" })).toHaveCount(0);
});

test("featured return waits for server confirmation and then shows the paid placement", async ({ page }) => {
  let paid = false;
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } }));
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => route.fulfill({ json: {
    owned: [{ opportunity_id: id, marketplace_opportunities: opportunity }],
    workers: [], decisions: [], applicants: [], featuredCheckoutAvailable: true,
    featured: [{ opportunity_id: id, status: paid ? "paid" : "pending", featured_until: paid ? "2099-10-20T12:00:00Z" : null }]
  } }));
  await page.goto(`/empleadores/mi-cuenta?featured=return&featured_opportunity=${id}`);
  await login(page);
  await expect(page.getByText(/Esperando la confirmación firmada del pago destacado/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar pago destacado" })).toHaveCount(0);
  paid = true;
  await expect(page.getByText(/Pago confirmado. Tu oportunidad está destacada hasta/)).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole("button", { name: "Destacar por RD$149 · 7 días" })).toHaveCount(0);
});

test("verified worker responds, withdraws, and controls Express consent without paying", async ({ page }) => {
  let decision = "";
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => {
    const request = route.request();
    if (request.method() === "POST") { decision = request.postDataJSON().decision; return route.fulfill({ json: { saved: true } }); }
    if (request.url().includes("mine=true")) return route.fulfill({ json: { owned: [], workers: [{ id: workerId, full_name: "Perfil fixture" }], decisions: decision ? [{ opportunity_id: id, worker_id: workerId, decision }] : [], applicants: [] } });
    return route.fulfill({ json: { opportunities: [opportunity] } });
  });
  await page.goto("/oportunidades"); await login(page);
  await expect(page.getByLabel("Mi perfil verificado")).toHaveValue(workerId);
  await page.locator(".opportunity-interest").getByRole("button", { name: "Me interesa", exact: true }).click();
  await expect(page.getByText("Interés enviado", { exact: true })).toBeVisible();
  await expect(page.getByText(/no confirma una contratación/)).toBeVisible();
  await page.getByRole("button", { name: "Retirar interés" }).click();
  await expect(page.getByText("Retiraste tu interés.")).toBeVisible();
  await page.getByRole("button", { name: "No me interesa" }).click();
  await expect(page.getByText("Respuesta NO guardada.", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Acepto recibir invitaciones Express por WhatsApp" }).click();
  await expect(page.getByText("Consentimiento para invitaciones Express guardado.")).toBeVisible();
  await page.getByRole("button", { name: "Retirar consentimiento de invitaciones" }).click();
  await expect(page.getByText("Consentimiento para invitaciones Express retirado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ListoRD Express" })).toHaveCount(0);
});

test("interested worker can initiate employer WhatsApp contact for free", async ({ page }) => {
  let decision = "";
  let purchases = 0;
  await page.route("**/api/stripe/**", route => { purchases++; return route.abort(); });
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => {
    const request = route.request();
    if (request.method() === "POST") { decision = request.postDataJSON().decision; return route.fulfill({ json: { saved: true } }); }
    if (request.url().includes("mine=true")) return route.fulfill({ json: { owned: [], workers: [{ id: workerId, full_name: "Perfil fixture" }], decisions: decision ? [{ opportunity_id: id, worker_id: workerId, decision }] : [], applicants: [] } });
    return route.fulfill({ json: { opportunities: [opportunity] } });
  });
  await page.route("**/api/marketplace/contacts", route => {
    expect(route.request().postDataJSON()).toEqual({ id, workerId });
    return route.fulfill({ json: { contacts: [{ workerId, url: "https://wa.me/18090000333" }] } });
  });
  await page.route("https://wa.me/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Employer WhatsApp fixture</h1>" }));
  await page.goto("/oportunidades"); await login(page);
  await page.locator(".opportunity-interest").getByRole("button", { name: "Me interesa", exact: true }).click();
  await page.getByRole("button", { name: "Contactar empleador gratis" }).click();
  await expect(page.getByRole("heading", { name: "Employer WhatsApp fixture" })).toBeVisible();
  expect(purchases).toBe(0);
});

test("worker invitation accepts only a profile owned by the authenticated account", async ({ page }) => {
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => route.fulfill({ json: route.request().url().includes("mine=true")
    ? { owned: [], workers: [{ id: workerId, full_name: "Perfil fixture" }], decisions: [], applicants: [] }
    : { opportunities: [opportunity] } }));
  await page.goto(`/oportunidades?id=${id}&worker=${workerId}`); await login(page);
  await expect(page.getByLabel("Mi perfil verificado")).toHaveValue(workerId);
  await page.goto(`/oportunidades?id=${id}&worker=33333333-3333-4333-8333-333333333333`);
  await expect(page.getByLabel("Mi perfil verificado")).toHaveValue(workerId);
});

test("unpaid employer sees interested workers and can close a listing without workspace access", async ({ page }) => {
  let status = "open";
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } }));
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => {
    const request = route.request();
    if (request.method() === "POST") { status = request.postDataJSON().status; return route.fulfill({ json: { saved: true } }); }
    return route.fulfill({ json: { owned: [{ opportunity_id: id, marketplace_opportunities: { ...opportunity, status } }], workers: [], decisions: [],
      applicants: [{ opportunity_id: id, worker_id: workerId, full_name: "Perfil interesado", city: "Puerto Plata", skills: ["Limpieza"], created_at: "2026-10-13T00:00:00Z" }] } });
  });
  await page.goto("/empleadores/mi-cuenta"); await login(page);
  await expect(page.getByRole("heading", { name: "Mis oportunidades" })).toBeVisible();
  await expect(page.getByText("Perfil interesado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Elegir y contactar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tu próximo equipo, en orden" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar oportunidad" }).click();
  await expect(page.getByText("Oportunidad retirada. Ya no acepta respuestas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Elegir y contactar" })).toHaveCount(0);
});

test("editing closes the old listing and opens a private structured copy for renewed consent", async ({ page }) => {
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } }));
  let closed = false; const actions: string[] = [];
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => {
    const request = route.request();
    if (request.method() === "POST") { const body = request.postDataJSON(); actions.push(body.action); closed = body.status === "closed"; return route.fulfill({ json: { saved: true } }); }
    return route.fulfill({ json: { owned: [{ opportunity_id: id, marketplace_opportunities: opportunity }], workers: [], decisions: [], applicants: [] } });
  });
  await page.goto("/empleadores/mi-cuenta"); await login(page);
  await page.getByRole("button", { name: "Editar y reenviar a revisión" }).click();
  await expect(page).toHaveURL(/\/solicitar$/);
  expect(closed).toBe(true);
  await expect(page.getByRole("heading", { name: "Así se verá tu solicitud." })).toBeVisible();
  await expect(page.getByLabel("Vista previa pública").getByText(/Pisos y baños/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeVisible();
  await expect(page.getByLabel(/Autorizo enviar estos términos públicos/)).not.toBeChecked();
  expect(actions).toEqual(["transition"]);
});

test("publication previews public terms and sends them only after explicit consent", async ({ page }) => {
  let submissions = 0;
  await page.addInitScript(value => sessionStorage.setItem("listord-reuse-request-v1", JSON.stringify(value)), draft);
  await page.route("**/api/marketplace", route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { opportunities: [] } });
    submissions++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ action: "create", consent: true, draft: { category: "limpieza", city: "Puerto Plata" } });
    return route.fulfill({ json: { saved: true, id } });
  });
  await page.goto("/solicitar");
  await expect(page.getByLabel("Vista previa pública")).toContainText("Pisos y baños");
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toHaveCount(0);
  await login(page);
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByLabel("Nombre de contacto privado").fill("Empleador fixture");
  await page.getByLabel("WhatsApp de contacto privado").fill("18090000111");
  await page.getByLabel(/Autorizo enviar estos términos públicos/).check();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Solicitud guardada para revisión. Aún no está publicada.")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("listord-pending-publication-draft-v1"))).toBeNull();
  expect(submissions).toBe(1);
});

test("marketplace API refuses forged identity and cross-origin mutation; Express remains gated", async ({ request }) => {
  const denied = await request.post("/api/marketplace", { data: { action: "decide", id, workerId, decision: "interested", actor: workerId } });
  expect(denied.status()).toBe(401);
  const crossOrigin = await request.post("/api/marketplace", { headers: { Origin: "https://evil.example.test" }, data: { action: "create" } });
  expect(crossOrigin.status()).toBe(400);
  expect((await request.post("/api/express", { data: { id, channel: "stripe" } })).status()).toBe(503);
});
