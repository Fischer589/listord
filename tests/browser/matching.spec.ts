import { expect, test, type Page } from "@playwright/test";

async function preview(page: Page) {
  await page.goto("/solicitar");
  await page.locator("#category").selectOption("limpieza");
  await page.locator("#city").fill("Puerto Plata");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("#property").selectOption("Casa");
  await page.locator("#tasks").fill("Pisos y baños");
  await page.locator("#supplies").selectOption("Los pongo yo");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("#timing").fill("Fecha flexible");
  await page.locator("#duration").fill("4 horas");
  await page.locator("#amount").fill("1500");
  await page.getByRole("button", { name: "Ver mi solicitud" }).click();
}
// Transport fixtures exercise browser states, not a claim of live inventory.
const fixture = {
  count: 2, windowDays: 30, checkedAt: "2026-10-08T12:00:00Z",
  workers: [1, 2].map(id => ({ id: `00000000-0000-4000-8000-00000000000${id}`, name: `Perfil de prueba ${id}`, city: "Puerto Plata", reasons: ["Oficio en su perfil", "Misma ciudad", "Disponibilidad declarada"], scopeEvidence: ["Pisos"] })),
};

test("free matching shows the RD$299 gate on contact and editing resets matches", async ({ page }) => {
  let searches = 0;
  let contacts = 0;
  await page.route("**/api/requests/matches", async route => {
    const body = route.request().postDataJSON();
    expect(body.category).toBe("limpieza");
    expect(body.answers.tasks).toBe("Pisos y baños");
    searches++;
    await route.fulfill({ json: fixture });
  });
  await page.route("**/api/requests/contact", async route => { contacts++; await route.fulfill({ status: 500, json: { error: "Unexpected unpaid handoff" } }); });
  await preview(page);
  await page.getByRole("button", { name: "Buscar trabajadores compatibles" }).click();
  await expect(page.getByRole("heading", { name: "Encontramos 2 trabajadores compatibles" })).toBeVisible();
  await expect(page.getByText("RD$299 — Pago único", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ENCONTRAR PERSONAL AHORA" })).toBeDisabled();
  await expect(page.getByText(/No han confirmado interés/)).toBeVisible();
  await page.getByRole("button", { name: "Contactar trabajador" }).first().click();
  const paywall = page.getByRole("dialog", { name: "¿Encontraste a la persona indicada?" });
  await expect(paywall).toBeVisible();
  await expect(paywall.getByText("Perfil seleccionado: Puerto Plata")).toBeVisible();
  await expect(page.getByRole("link", { name: "Desbloquear contactos — RD$299" })).toHaveAttribute("href", `/empleadores/pago?worker=${fixture.workers[0].id}`);
  expect(contacts).toBe(0); expect(searches).toBe(1);
  await page.getByRole("button", { name: "Seguir explorando" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Editar fecha y pago" }).click();
  await page.locator("#duration").fill("5 horas");
  await page.getByRole("button", { name: "Ver mi solicitud" }).click();
  await expect(page.getByText("Encontramos 2 trabajadores compatibles")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buscar trabajadores compatibles" })).toBeVisible();
});

test("database failure is not zero; retry yields honest empty state", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/requests/matches", async route => {
    calls++;
    await route.fulfill(calls === 1 ? { status: 503, json: { error: "unavailable" } } : { json: { ...fixture, workers: [], count: 0 } });
  });
  await preview(page);
  await page.getByRole("button", { name: "Buscar trabajadores compatibles" }).click();
  await expect(page.getByText(/No pudimos verificar los perfiles/)).toBeVisible();
  await expect(page.getByText(/Encontramos \d+ trabajadores/)).toHaveCount(0);
  await page.getByRole("button", { name: "Buscar trabajadores compatibles" }).click();
  await expect(page.getByRole("heading", { name: "Encontramos 0 trabajadores compatibles" })).toBeVisible();
  await expect(page.getByText(/disponibilidad desconocida o perfiles antiguos/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Contactar trabajador" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ENCONTRAR PERSONAL AHORA" })).toBeDisabled();
});

test("production route rejects malformed anonymous input before querying data", async ({ request }) => {
  const response = await request.post("/api/requests/matches", { data: { category: "__proto__" } });
  expect(response.status()).toBe(400);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(await response.json()).toEqual({ error: "Revisa los detalles de tu solicitud." });
});
