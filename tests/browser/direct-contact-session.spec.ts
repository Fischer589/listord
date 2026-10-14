import { expect, test, type BrowserContext } from "@playwright/test";

test.skip(process.env.WORKER_CAROUSEL_FIXTURE !== "1", "Uses the isolated direct-contact browser fixture.");

const worker = "00000000-0000-4000-8000-000000000001";
const employer = "11111111-1111-4111-8111-111111111111";
const access = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ sub: employer, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"),
  "fixture_signature_not_live"].join(".");
const refresh = "fixture_direct_contact_refresh_token_not_live_123456789";
const user = { id: employer, aud: "authenticated", email: "employer@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
const base = "http://127.0.0.1:3188";

async function mockSession(context: BrowserContext) {
  await context.route("**/auth/v1/**", route => route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json:
    route.request().url().includes("/verify")
      ? { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: "bearer", user }
      : { user } }));
  await context.route("**/api/marketplace-session", route => {
    const method = route.request().method();
    if (method === "POST") return route.fulfill({ status: 204, body: "", headers: { "Set-Cookie": "listord-marketplace-session-dev=fixture; Path=/; HttpOnly; SameSite=Lax" } });
    if (method === "DELETE") return route.fulfill({ status: 204, body: "", headers: { "Set-Cookie": "listord-marketplace-session-dev=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" } });
    return route.fulfill((route.request().headers().cookie ?? "").includes("listord-marketplace-session-dev=fixture")
      ? { json: { access_token: access, refresh_token: refresh } } : { status: 401, json: { error: "Sin sesión" } });
  });
  await context.route("**/api/contact-access?worker=**", route => route.fulfill({ json: { active: false } }));
  await context.route("**/api/employer-workspace", route => route.fulfill({ json: { active: false, accessUntil: null, candidates: [], requests: [], contacts: [] } }));
  await context.route("**/api/marketplace?mine=true", route => route.fulfill({ json: { owned: [], workers: [], decisions: [], applicants: [], featured: [] } }));
}

test("existing verified employer reaches RD$89 Checkout after refresh without another code or temporary storage", async ({ page, context }) => {
  await mockSession(context);
  await context.addCookies([{ name: "listord-marketplace-session-dev", value: "fixture", url: base, httpOnly: true, sameSite: "Lax" }]);
  await page.addInitScript(() => Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new Error("storage blocked"); } }));
  let checkout = 0;
  await context.route("**/api/stripe/direct-contact-checkout", route => {
    checkout++;
    expect(route.request().postDataJSON()).toEqual({ workerId: worker });
    expect(route.request().headers().authorization).toBe(`Bearer ${access}`);
    return route.fulfill({ json: { sessionId: "cs_test_direct_fixture", url: "https://checkout.stripe.com/test/direct-fixture" } });
  });
  await context.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Stripe Checkout fixture</h1>" }));
  await page.goto(`/empleadores/contacto?worker=${worker}`);
  await expect(page.getByRole("heading", { name: "Stripe Checkout fixture" })).toBeVisible();
  expect(checkout).toBe(1);
  const returned = await context.newPage();
  await returned.goto(`/empleadores/mi-cuenta?checkout=return&product=direct&worker=${worker}&session_id=cs_test_direct_fixture`);
  await expect(returned.getByText("Sesión verificada.")).toBeVisible();
  await expect(returned.getByRole("button", { name: "Enviar código" })).toHaveCount(0);
});

test("fresh employer email link keeps the worker and verified session through Checkout", async ({ page, context }) => {
  await mockSession(context);
  let checkout = 0;
  await context.route("**/api/stripe/direct-contact-checkout", route => {
    checkout++;
    expect(route.request().postDataJSON()).toEqual({ workerId: worker });
    return route.fulfill({ json: { sessionId: "cs_test_direct_fixture", url: "https://checkout.stripe.com/test/direct-fixture" } });
  });
  await context.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Stripe Checkout fixture</h1>" }));
  await context.route("**/auth/v1/otp**", route => {
    const redirect = new URL(route.request().url()).searchParams.get("redirect_to");
    expect(redirect).toBe(`${base}/auth/callback/direct?worker=${worker}`);
    return route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: {} });
  });
  await page.goto(`/empleadores/contacto?worker=${worker}`);
  await page.getByLabel("Correo electrónico").fill("employer@example.test");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByLabel("Código de verificación")).toBeVisible();
  await page.goto("about:blank"); // Email opens after the original tab is gone.
  await page.goto(`/auth/callback/direct?worker=${worker}&token_hash=fixture_hash&type=email`);
  await expect(page.getByRole("heading", { name: "Stripe Checkout fixture" })).toBeVisible();
  expect(checkout).toBe(1);
  expect(await context.cookies()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "listord-marketplace-session-dev", httpOnly: true })]));
});
