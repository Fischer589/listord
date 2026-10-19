import { expect, test } from "@playwright/test";
import { emptyRequest } from "../../lib/request-specification";

const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" }, timing: "Mañana a las nueve", duration: "4 horas", amount: "1500" };

test("publication email requests the ListoRD callback and restores the same-tab draft", async ({ page }) => {
  let redirects = 0;
  await page.route("**/auth/v1/otp**", route => {
    redirects++;
    const url = new URL(route.request().url());
    expect(url.searchParams.get("redirect_to")).toBe("http://127.0.0.1:3188/auth/callback/publish");
    expect(route.request().postDataJSON().email).toBe("publisher@example.test");
    return route.fulfill({ json: {} });
  });
  await page.goto("/solicitar");
  await expect(page.getByRole("heading", { name: "¿Qué necesitas? ¿Dónde?" })).toBeVisible();
  await page.evaluate(value => sessionStorage.setItem("listord-reuse-request-v1", JSON.stringify(value)), draft);
  await page.reload();
  await expect(page.getByLabel("Vista previa pública")).toContainText("Pisos y baños");
  await page.getByLabel("Correo electrónico").fill("publisher@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect.poll(() => redirects).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("listord-pending-publication-draft-v1"))).not.toBeNull();
  await page.goto("about:blank");
  await page.goto("/solicitar");
  await expect(page.getByLabel("Vista previa pública")).toContainText("Pisos y baños");
  expect(await page.evaluate(() => sessionStorage.getItem("listord-pending-publication-draft-v1"))).toBeNull();
});

test("valid ListoRD callback verifies token hash and returns to the saved opportunity draft", async ({ page }) => {
  await page.route("**/api/marketplace-session", route => route.fulfill({ status: route.request().method() === "POST" ? 204 : 401, body: "" }));
  const accessToken = "fixture_publisher_access_token_not_live_123456789";
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "publisher@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  await page.route("**/auth/v1/verify", route => {
    expect(route.request().postDataJSON()).toMatchObject({ token_hash: "fixture_token_hash", type: "email" });
    return route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: {
      access_token: accessToken, refresh_token: "fixture_publisher_refresh_not_live", expires_in: 3600, token_type: "bearer", user
    } });
  });
  await page.route("**/auth/v1/user", route => route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: { user } }));
  await page.goto("/solicitar");
  await expect(page.getByRole("heading", { name: "¿Qué necesitas? ¿Dónde?" })).toBeVisible();
  await page.getByLabel("¿Qué necesitas?").selectOption("limpieza");
  await page.getByLabel("¿Dónde?").fill("Puerto Plata");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Lo esencial para decirte que sí." })).toBeVisible();
  await page.evaluate(value => sessionStorage.setItem("listord-pending-publication-draft-v1", JSON.stringify({ draft: value, savedAt: Date.now() })), draft);
  expect(await page.evaluate(() => sessionStorage.getItem("listord-pending-publication-draft-v1"))).not.toBeNull();
  await page.goto("about:blank");
  await page.goto("/auth/callback/publish?token_hash=fixture_token_hash&type=email");
  await expect(page).toHaveURL("http://127.0.0.1:3188/solicitar");
  await expect(page.getByLabel("Vista previa pública")).toContainText("Pisos y baños");
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("listord-marketplace-session-v1"))).not.toBeNull();
});

test("Supabase fragment callback returns worker applications to the free board without exposing tokens", async ({ page }) => {
  await page.route("**/api/marketplace-session", route => route.fulfill({ status: route.request().method() === "POST" ? 204 : 401, body: "" }));
  const accessToken = "fixture_worker_access_token_not_live_123456789";
  const user = { id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", email: "worker@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  await page.route("**/auth/v1/user", route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${accessToken}`);
    return route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: { user } });
  });
  await page.route(/\/api\/marketplace(?:\?.*)?$/, route => route.fulfill({ json: route.request().url().includes("mine=true")
    ? { owned: [], workers: [], decisions: [], applicants: [] }
    : { opportunities: [] } }));
  await page.goto(`/auth/callback/apply#access_token=${accessToken}&refresh_token=fixture_worker_refresh_not_live&expires_in=3600&token_type=bearer&type=magiclink`);
  await expect(page).toHaveURL("http://127.0.0.1:3188/oportunidades");
  await expect(page.getByText("Sesión verificada.")).toBeVisible();
});

test("expired or malformed links clear URL tokens and never authenticate", async ({ page }) => {
  await page.route("**/auth/v1/verify", route => route.fulfill({
    status: 400, headers: { "Access-Control-Allow-Origin": "*" }, json: { code: "otp_expired", msg: "Expired" }
  }));
  await page.goto("/auth/callback/publish?token_hash=expired_fixture&type=email");
  await expect(page.locator('p[role="alert"]')).toContainText("El enlace de verificación venció o no es válido.");
  await expect(page).toHaveURL("http://127.0.0.1:3188/auth/callback/publish");
  expect(await page.evaluate(() => sessionStorage.getItem("listord-marketplace-session-v1"))).toBeNull();
  await page.getByRole("link", { name: "Volver a ListoRD" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3188/solicitar");
  await page.goto("/auth/callback/publish?token_hash=fixture_hash&type=https://evil.example");
  await expect(page.locator('p[role="alert"]')).toContainText("El enlace de verificación venció o no es válido.");
  await expect(page).toHaveURL("http://127.0.0.1:3188/auth/callback/publish");
});
