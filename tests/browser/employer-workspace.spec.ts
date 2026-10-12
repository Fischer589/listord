import { expect, test } from "@playwright/test";

const workerId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";

test("email button explains invalid input and sends an OTP request for a valid address", async ({ page }) => {
  let requests = 0;
  let fail = true;
  await page.route("**/auth/v1/otp**", route => {
    requests++;
    expect(route.request().method()).toBe("POST");
    expect(new URL(route.request().url()).searchParams.get("redirect_to")).toBe("http://127.0.0.1:3188/empleadores/mi-cuenta");
    return route.fulfill(fail
      ? { status: 400, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "X-Supabase-Api-Version", "X-Supabase-Api-Version": "2024-01-01" }, json: { code: "email_address_not_authorized", msg: "Email address not authorized" } }
      : { json: {} });
  });
  await page.goto("/empleadores/mi-cuenta");
  const email = page.getByLabel("Correo electrónico");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByRole("status")).toHaveText("Escribe tu correo electrónico para recibir el código.");
  expect(requests).toBe(0);

  await email.fill("correo-invalido");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByRole("status")).toHaveText("Escribe un correo electrónico válido.");
  expect(requests).toBe(0);

  await email.fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByRole("status")).toHaveText("Este correo no está autorizado para recibir códigos. Contacta al administrador.");
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeEnabled();
  fail = false;
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByLabel("Código de verificación")).toBeVisible();
});

// Browser transport fixtures verify the paid UI state. Signed provider events,
// ledger writes and access control are checked in the server tests, not here.
test("unpaid employer cannot use workspace; verified paid state enables saved candidates and private requests until expiry", async ({ page }) => {
  let active = false;
  let saved = false;
  let requestTitle = "";
  await page.route("**/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/verify")
    ? { access_token: "fixture_access_token_not_live_123456789", refresh_token: "fixture_refresh_not_live", expires_in: 3600, token_type: "bearer", user: { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" } }
    : {} }));
  await page.route("**/api/employer-workspace", async route => {
    const req = route.request();
    expect(req.headers().authorization).toMatch(/^Bearer fixture_access_token_/);
    if (req.method() === "GET") return route.fulfill({ json: { active, accessUntil: active ? "2099-01-01T00:00:00Z" : null,
      candidates: saved ? [{ id: workerId, full_name: "Perfil de prueba", city: "Puerto Plata", skills: ["limpieza"], savedAt: "2026-01-01T00:00:00Z" }] : [],
      requests: requestTitle ? [{ id: requestId, title: requestTitle, details: "Zona general", status: "open", created_at: "2026-01-01T00:00:00Z" }] : [], contacts: [] } });
    const body = req.postDataJSON();
    if (!active) return route.fulfill({ status: 403, json: { error: "Sin acceso" } });
    if (body.action === "save_candidate") { expect(body.workerId).toBe(workerId); saved = true; }
    if (body.action === "add_request") requestTitle = body.title;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/stripe/workspace-checkout", route => route.fulfill({ json: { url: "https://checkout.stripe.com/test/cs_fixture" } }));
  await page.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Stripe Checkout fixture</h1>" }));
  await page.goto(`/empleadores/mi-cuenta?worker=${workerId}`);
  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByRole("button", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar candidato" })).toHaveCount(0);
  await page.getByRole("button", { name: "Comprar 30 días · RD$299" }).click();
  await expect(page.getByRole("heading", { name: "Stripe Checkout fixture" })).toBeVisible();
  active = true; // Fixture models verified webhook fulfillment; redirect alone does not set this.
  await page.goto("/empleadores/mi-cuenta?checkout=return");
  await expect(page.getByRole("button", { name: "Guardar candidato" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar candidato" }).click();
  await expect(page.getByRole("heading", { name: "Perfil de prueba" })).toBeVisible();
  await page.getByLabel("Título").fill("Limpieza semanal");
  await page.getByLabel("Detalles").fill("Zona general");
  await page.getByRole("button", { name: "Guardar solicitud" }).click();
  await expect(page.getByRole("heading", { name: "Limpieza semanal" })).toBeVisible();
  active = false; // Expired entitlement fixture.
  await page.reload();
  await expect(page.getByRole("button", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfil de prueba" })).toHaveCount(0);
});
