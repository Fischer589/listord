import { expect, test } from "@playwright/test";

const worker = "00000000-0000-4000-8000-000000000001";
const employer = "11111111-1111-4111-8111-111111111111";
const access = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ sub: employer, role: "authenticated", exp: 4070908800 })).toString("base64url"),
  "fixture_signature_not_live"].join(".");
const user = { id: employer, aud: "authenticated", email: "employer@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z" };

test("verified employer sees three credit packs, balance, and unlocked contacts before Checkout", async ({ page, context }) => {
  await context.addCookies([{ name: "listord-marketplace-session-dev", value: "fixture",
    url: "http://127.0.0.1:3188", httpOnly: true, sameSite: "Lax" }]);
  await context.route("**/auth/v1/**", route => route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" },
    json: route.request().url().includes("/verify")
      ? { access_token: access, refresh_token: "fixture_refresh", expires_in: 3600, token_type: "bearer", user }
      : { user } }));
  await context.route("**/api/marketplace-session", route => route.fulfill({
    json: { access_token: access, refresh_token: "fixture_refresh" } }));
  await context.route("**/api/contact-credits", route => route.fulfill({
    json: { remaining: 2, unlocked: [{ workerId: worker, name: "Ana" }], legacyActive: false } }));
  await context.route("**/api/contact-access?worker=**", route => route.fulfill({
    json: { active: true, remaining: 2, alreadyUnlocked: true } }));
  const packs: number[] = [];
  await context.route("**/api/stripe/contact-credits-checkout", route => {
    packs.push(route.request().postDataJSON().pack);
    expect(route.request().headers().authorization).toBe(`Bearer ${access}`);
    return route.fulfill({ json: { url: "https://checkout.stripe.com/test/credits_fixture" } });
  });
  await context.route("https://checkout.stripe.com/**", route => route.fulfill({
    contentType: "text/html", body: "<h1>Stripe Checkout fixture</h1>" }));

  await page.goto(`/empleadores/contacto?worker=${worker}`);
  await expect(page.getByText("Sesión verificada.")).toBeVisible();
  await expect(page.getByText("Créditos disponibles: 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Contactar otra vez" })).toBeVisible();
  for (const pack of [1, 5, 10]) {
    await page.getByRole("button", { name: `Comprar ${pack}`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Stripe Checkout fixture" })).toBeVisible();
    await page.goto(`/empleadores/contacto?worker=${worker}`);
    await expect(page.getByRole("button", { name: `Comprar ${pack}`, exact: true })).toBeVisible();
  }
  expect(packs).toEqual([1, 5, 10]);
});
