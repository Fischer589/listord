import { expect, test } from "@playwright/test";

const workerId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";

test("public employer page explains the optional paid pass and keeps free access clear", async ({ page }) => {
  await page.goto("/empleadores");
  const offer = page.getByRole("region", { name: "Organiza tu búsqueda durante 30 días" });
  await expect(offer).toContainText("RD$299 · pago único · sin renovación automática");
  await expect(offer).toContainText("sigue siendo gratis");
  await expect(offer.getByRole("link", { name: "Ver el pase y mi cuenta" })).toHaveAttribute("href", "/empleadores/mi-cuenta");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("active employer opening payment page is sent to the existing pass without checkout", async ({ page }) => {
  const token = "fixture_active_pass_not_live_123456789";
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  let checkoutRequests = 0;
  await page.route("**/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/verify")
    ? { access_token: token, refresh_token: "fixture_active_refresh_not_live", expires_in: 3600, token_type: "bearer", user }
    : { user } }));
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: { active: true, accessUntil: "2099-01-01T00:00:00Z", candidates: [], requests: [], contacts: [] } }));
  await page.route("**/api/stripe/workspace-checkout", route => { checkoutRequests++; return route.fulfill({ status: 409, json: { error: "Tu espacio ya está activo." } }); });
  await page.goto("/empleadores/pago");
  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByText("Tu Pase de Empleador ya está activo.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir mi espacio" })).toHaveAttribute("href", "/empleadores/mi-cuenta");
  expect(checkoutRequests).toBe(0);
});

test("email button explains invalid input and sends an OTP request for a valid address", async ({ page }) => {
  let requests = 0;
  let fail = true;
  await page.route("**/auth/v1/otp**", route => {
    requests++;
    expect(route.request().method()).toBe("POST");
    expect(new URL(route.request().url()).searchParams.get("redirect_to")).toBe("http://127.0.0.1:3188/auth/callback/account");
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

test("magic-link callback validates and stores the session, clears URL tokens, and survives refresh without paid access", async ({ page }) => {
  const accessToken = "fixture_magic_access_token_not_live_123456789";
  const refreshToken = "fixture_magic_refresh_token_not_live_123456789";
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  let userValidations = 0;
  await page.route("**/auth/v1/user", route => {
    userValidations++;
    expect(route.request().headers().authorization).toBe(`Bearer ${accessToken}`);
    return route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: { user } });
  });
  await page.route("**/api/employer-workspace", route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${accessToken}`);
    return route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } });
  });
  await page.goto(`/empleadores/mi-cuenta#access_token=${accessToken}&refresh_token=${refreshToken}&expires_in=3600&token_type=bearer&type=magiclink`);
  await expect(page.getByRole("link", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3188/empleadores/mi-cuenta");
  expect(userValidations).toBeGreaterThan(0);
  expect(await page.evaluate(() => sessionStorage.getItem("listord-marketplace-session-v1"))).not.toBeNull();
  await expect(page.getByRole("button", { name: "Guardar candidato" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar código" })).toHaveCount(0);
  await expect(page).toHaveURL("http://127.0.0.1:3188/empleadores/mi-cuenta");
});

test("failed magic-link validation clears sensitive URL tokens and offers a fresh login", async ({ page }) => {
  await page.route("**/auth/v1/user", route => route.fulfill({
    status: 401, headers: { "Access-Control-Allow-Origin": "*", "X-Supabase-Api-Version": "2024-01-01" },
    json: { code: "bad_jwt", msg: "Invalid token" },
  }));
  await page.goto("/empleadores/mi-cuenta#access_token=fixture_invalid_magic_token&refresh_token=fixture_invalid_refresh&expires_in=3600&token_type=bearer&type=magiclink");
  await expect(page).toHaveURL("http://127.0.0.1:3188/empleadores/mi-cuenta");
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("El enlace de verificación venció o no es válido. Solicita un nuevo código.");
  expect(await page.evaluate(() => sessionStorage.getItem("listord-marketplace-session-v1"))).toBeNull();
});

test("Checkout return in a new tab resumes auth once; payment and expiry still come only from the server", async ({ page, context }) => {
  const token = "fixture_checkout_return_access_not_live_123456789";
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  let active = false;
  await context.route("**/auth/v1/**", route => route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json:
    route.request().url().includes("/verify")
      ? { access_token: token, refresh_token: "fixture_checkout_return_refresh_not_live", expires_in: 3600, token_type: "bearer", user }
      : { user } }));
  await context.route("**/api/employer-workspace", route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({ json: { active, accessUntil: active ? "2099-01-01T00:00:00Z" : null, candidates: [], requests: [], contacts: [] } });
  });
  await context.route("**/api/stripe/workspace-checkout", route => route.fulfill({ json: { mode: "hosted", url: "https://checkout.stripe.com/test/cs_fixture", sessionId: "cs_test_workspace_fixture" } }));
  await context.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html",
    body: '<h1>Stripe Checkout fixture</h1><a href="http://127.0.0.1:3188/empleadores/mi-cuenta?checkout=return&amp;session_id=cs_test_workspace_fixture">Return</a>' }));
  await page.goto("/empleadores/mi-cuenta");
  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByRole("link", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await page.getByRole("link", { name: "Comprar 30 días · RD$299" }).click();
  await expect(page.getByRole("heading", { name: "Confirma tu pase" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar en Stripe" }).click();
  await expect(page.getByRole("heading", { name: "Stripe Checkout fixture" })).toBeVisible();

  const mismatched = await context.newPage();
  await mismatched.goto("/empleadores/mi-cuenta?checkout=return&session_id=cs_test_other_fixture");
  await expect(mismatched.getByRole("button", { name: "Enviar código" })).toBeVisible();
  const returned = await context.newPage();
  await returned.goto("https://checkout.stripe.com/test/cs_fixture");
  await returned.getByRole("link", { name: "Return" }).click();
  await expect(returned.getByText("Sesión verificada en esta pestaña.")).toBeVisible();
  await expect(returned.getByText("Esperando confirmación del pago por Stripe.", { exact: false })).toBeVisible();
  await expect(returned.getByRole("button", { name: "Guardar solicitud" })).toHaveCount(0);
  expect(await returned.evaluate(() => document.cookie.includes("listord_workspace_checkout_bridge_v1="))).toBe(false);
  active = true; // Fixture models a server-side paid entitlement, never the URL query.
  await returned.getByRole("button", { name: "Actualizar estado" }).click();
  await expect(returned.getByRole("button", { name: "Guardar solicitud" })).toBeVisible();
  await returned.reload();
  await expect(returned.getByRole("button", { name: "Guardar solicitud" })).toBeVisible();
  active = false; // Server-side entitlement expired.
  await returned.reload();
  await expect(returned.getByRole("link", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(returned.getByRole("button", { name: "Guardar solicitud" })).toHaveCount(0);

  const unrelatedTab = await context.newPage();
  await unrelatedTab.goto("/empleadores/mi-cuenta?checkout=return&session_id=cs_test_workspace_fixture");
  await expect(unrelatedTab.getByRole("button", { name: "Enviar código" })).toBeVisible();
  await returned.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem("listord-marketplace-session-v1")!);
    document.cookie = `listord_workspace_checkout_bridge_v1=${encodeURIComponent(JSON.stringify({
      expiresAt: Date.now() - 1, sessionId: "cs_test_workspace_fixture", session,
    }))}; Max-Age=3000; Path=/empleadores/mi-cuenta; SameSite=Strict`;
  });
  const expiredTab = await context.newPage();
  await expiredTab.goto("/empleadores/mi-cuenta?checkout=return&session_id=cs_test_workspace_fixture");
  await expect(expiredTab.getByRole("button", { name: "Enviar código" })).toBeVisible();
  expect(await expiredTab.evaluate(() => document.cookie.includes("listord_workspace_checkout_bridge_v1="))).toBe(false);
});

// Browser transport fixtures verify the paid UI state. Signed provider events,
// ledger writes and access control are checked in the server tests, not here.
test("unpaid employer cannot use workspace; verified paid state enables saved candidates and private requests until expiry", async ({ page }) => {
  let active = false;
  let saved = false;
  let requestTitle = "";
  await page.route("**/api/marketplace?mine=true", route => route.fulfill({ json: { owned: [], workers: [], decisions: [], applicants: [], featured: [] } }));
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
  await page.route("**/api/stripe/workspace-checkout", route => route.fulfill({ json: { mode: "hosted", url: "https://checkout.stripe.com/test/cs_fixture", sessionId: "cs_test_workspace_fixture" } }));
  await page.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Stripe Checkout fixture</h1>" }));
  await page.goto(`/empleadores/mi-cuenta?worker=${workerId}`);
  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByRole("link", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar candidato" })).toHaveCount(0);
  await page.getByRole("link", { name: "Comprar 30 días · RD$299" }).click();
  await expect(page.getByRole("heading", { name: "Confirma tu pase" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar en Stripe" }).click();
  await expect(page.getByRole("heading", { name: "Stripe Checkout fixture" })).toBeVisible();
  active = true; // Fixture models verified webhook fulfillment; redirect alone does not set this.
  await page.goto("/empleadores/mi-cuenta?checkout=return&session_id=cs_test_workspace_fixture");
  await expect(page.getByRole("button", { name: "Guardar candidato" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar candidato" }).click();
  await expect(page.getByRole("heading", { name: "Perfil de prueba" })).toBeVisible();
  await page.getByLabel("Título").fill("Limpieza semanal");
  await page.getByLabel("Detalles").fill("Zona general");
  await page.getByRole("button", { name: "Guardar solicitud" }).click();
  await expect(page.getByRole("heading", { name: "Limpieza semanal" })).toBeVisible();
  active = false; // Expired entitlement fixture.
  await page.reload();
  await expect(page.getByRole("link", { name: "Comprar 30 días · RD$299" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfil de prueba" })).toHaveCount(0);
});

test("employer forms and dashboard controls remain separated and usable at narrow and wide widths", async ({ page }) => {
  const token = "fixture_layout_access_not_live_123456789";
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  await page.route("**/auth/v1/**", route => route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: route.request().url().includes("/verify")
    ? { access_token: token, refresh_token: "fixture_layout_refresh_not_live", expires_in: 3600, token_type: "bearer", user }
    : { user } }));
  await page.route("**/api/employer-workspace", route => route.fulfill({ json: {
    active: true, accessUntil: "2099-01-01T00:00:00Z",
    candidates: [{ id: workerId, full_name: "Perfil de prueba con un nombre largo", city: "Puerto Plata", skills: ["limpieza"], savedAt: "2026-01-01T00:00:00Z" }],
    requests: [{ id: requestId, title: "Limpieza semanal", details: "Zona general", status: "open", created_at: "2026-01-01T00:00:00Z" }],
    contacts: [{ id: "44444444-4444-4444-8444-444444444444", worker_id: workerId, worker_name: "Perfil de prueba", request_id: requestId, created_at: "2026-01-01T00:00:00Z" }],
  } }));

  await page.goto("/empleadores/mi-cuenta");
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const emailGap = await page.getByLabel("Correo electrónico").evaluate(input => {
      const label = input.closest("label")!;
      const range = document.createRange();
      range.selectNodeContents(label.firstChild!);
      return input.getBoundingClientRect().top - range.getBoundingClientRect().bottom;
    });
    expect(emailGap).toBeGreaterThanOrEqual(4);
  }

  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page.getByRole("heading", { name: "Tu pase está activo" })).toBeVisible();
  await expect(page.getByText("Válido hasta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candidatos guardados" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solicitudes privadas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registro de contacto" })).toBeVisible();

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const geometry = await page.locator(".employer-account").evaluate(root => {
      const fields = Array.from(root.querySelectorAll("label")).map(label => {
        const control = label.querySelector("input, textarea, select")!;
        const range = document.createRange();
        range.selectNodeContents(label.firstChild!);
        return control.getBoundingClientRect().top - range.getBoundingClientRect().bottom;
      });
      const actions = Array.from(root.querySelectorAll(".workspace-item .workspace-actions > *")).map(item => item.getBoundingClientRect());
      const actionsOverlap = actions.some((a, i) => actions.slice(i + 1).some(b =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
      return { fields, actionsOverlap, pageOverflows: root.scrollWidth > root.clientWidth + 1 };
    });
    expect(geometry.fields).toHaveLength(3);
    expect(geometry.fields.every(gap => gap >= 4)).toBe(true);
    expect(geometry.actionsOverlap).toBe(false);
    expect(geometry.pageOverflows).toBe(false);
  }
  await page.getByLabel("Título").focus();
  await expect(page.getByLabel("Título")).toBeFocused();
});
