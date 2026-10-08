import { expect, test } from "@playwright/test";
const key = "a".repeat(64);
test("private availability link: expired -> renew -> pause, no registration and no analytics secret", async ({ page }) => {
  const analytics: string[] = [];
  const actions: unknown[] = [];
  await page.route("**/api/analytics/events", async route => {
    analytics.push(route.request().postData() ?? "");
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/workers/availability", async route => {
    const body = route.request().postDataJSON();
    expect(body.key).toBe(key);
    actions.push(body.action);
    await route.fulfill({ json: body.action === "status" ? { available: true, confirmedAt: "2020-01-01", fresh: false } : { available: body.available, confirmedAt: new Date().toISOString(), fresh: body.available } });
  });
  await page.goto(`/trabajadores/disponibilidad#clave=${key}`);
  await expect(page.getByText("Tu disponibilidad venció. Confirma si puedes recibir solicitudes.")).toBeVisible();
  await expect(page).toHaveURL(/\/trabajadores\/disponibilidad$/);
  await page.getByRole("button", { name: "Sí, estoy disponible", exact: true }).click();
  await expect(page.getByText("Disponibilidad vigente por 30 días desde tu última confirmación.")).toBeVisible();
  await page.getByRole("button", { name: "Ahora no estoy disponible", exact: true }).click();
  await expect(page.getByText("No estás marcado como disponible.")).toBeVisible();
  expect(actions).toEqual(["status", "renew", "renew"]);
  expect(analytics.join(" ")).not.toContain(key);
  expect(analytics.join(" ")).not.toContain("clave");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("missing/invalid private links cannot renew, errors do not claim success", async ({ page }) => {
  await page.goto("/trabajadores/disponibilidad#clave=legacy-edit-token");
  await expect(page.getByRole("button", { name: "Sí, estoy disponible", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Necesito ayuda con mi acceso" })).toBeVisible();
  await page.route("**/api/workers/availability", route => route.fulfill({ status: 403, json: { error: "Este enlace no está vigente o el perfil no está aprobado." } }));
  await page.goto(`/trabajadores/disponibilidad#clave=${key}`);
  await expect(page.getByRole("alert").filter({ hasText: "Este enlace no está vigente" })).toBeVisible();
  await expect(page.getByText("Disponibilidad vigente por 30 días desde tu última confirmación.")).toHaveCount(0);
});

test("worker URLs suppress referrers and analytics omit legacy edit-token query", async ({ page }) => {
  const events: string[] = [];
  await page.route("**/api/analytics/events", async route => { events.push(route.request().postData() ?? ""); await route.fulfill({ json: { ok: true } }); });
  const response = await page.goto("/trabajadores/editar?token=22222222-2222-4222-8222-222222222222");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect.poll(() => events.length).toBeGreaterThan(0);
  expect(events.join(" ")).not.toContain("22222222-2222-4222-8222-222222222222");
  expect(events.join(" ")).not.toContain("?token");
});
