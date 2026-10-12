import { expect, test } from "@playwright/test";

test.skip(!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, "Run with a fixture publishable key to exercise Embedded Checkout.");

// Stripe.js and the Checkout Session are browser fixtures. Entitlement remains
// server-controlled; this test does not represent a real Stripe payment.
test("embedded pass stays inactive until server access is confirmed and fits mobile and desktop", async ({ page }) => {
  const token = "fixture_embedded_access_not_live_123456789";
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  let active = false;
  let checkoutRequests = 0;
  await page.route("**/auth/v1/**", route => route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json:
    route.request().url().includes("/verify")
      ? { access_token: token, refresh_token: "fixture_embedded_refresh_not_live", expires_in: 3600, token_type: "bearer", user }
      : { user } }));
  await page.route("**/api/employer-workspace", route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({ json: { active, accessUntil: active ? "2099-01-01T00:00:00Z" : null,
      candidates: [], requests: [], contacts: [] } });
  });
  await page.route("**/api/stripe/workspace-checkout", route => {
    checkoutRequests++;
    expect(route.request().postDataJSON()).toMatchObject({ mode: "embedded" });
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({ json: { mode: "embedded", sessionId: "cs_test_embedded_fixture",
      clientSecret: "cs_test_embedded_fixture_secret_fixture" } });
  });
  await page.route("https://js.stripe.com/**/stripe.js", route => route.fulfill({ contentType: "application/javascript", body: `
    window.Stripe = function () { return { createEmbeddedCheckoutPage: async function ({ onComplete }) { return {
      mount: function (target) { var button = document.createElement('button'); button.type = 'button';
        button.textContent = 'Completar formulario de prueba'; button.onclick = onComplete; target.appendChild(button); },
      destroy: function () {}
    }; } }; }; window.Stripe.version = 'endive';
  ` }));

  await page.goto("/empleadores/mi-cuenta");
  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await page.getByRole("link", { name: "Comprar 30 días · RD$299" }).click();
  await expect(page.getByText("RD$299 · 30 días · Pago único · Sin renovación automática")).toBeVisible();
  await expect(page.getByText("A BLACKTHORNE BRAND")).toBeVisible();
  await expect(page.getByRole("button", { name: "Completar formulario de prueba" })).toBeVisible();
  expect(checkoutRequests).toBe(1);
  const overflow = await page.locator(".payment-page").evaluate(root => root.scrollWidth > root.clientWidth + 1);
  expect(overflow).toBe(false);

  await page.getByRole("button", { name: "Completar formulario de prueba" }).click();
  await expect(page.getByText("todavía no se ha activado el pase", { exact: false })).toBeVisible();
  await expect(page.getByText("Tu pase está activo")).toHaveCount(0);
  active = true; // Fixture models a confirmed server-side entitlement.
  await expect(page.getByText("Pago confirmado. Tu Pase de Empleador está activo.", { exact: false })).toBeVisible({ timeout: 12000 });
  await expect(page).toHaveURL("http://127.0.0.1:3188/empleadores/mi-cuenta", { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Tu pase está activo" })).toBeVisible();
});
