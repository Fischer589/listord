import { expect, test } from "@playwright/test";

test("owner can sign in, reach dashboard and open opportunity moderation", async ({ page, context }) => {
  // Next.js normalizes loopback IP redirects to localhost in production builds.
  await page.goto("http://localhost:3188/admin/login");
  await page.getByLabel("Usuario").fill("owner-browser-fixture");
  await page.getByLabel("Contraseña").fill("wrong");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/admin\/login\?error=invalid$/);
  await expect(page.getByText("Credenciales incorrectas. Intenta de nuevo.")).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === "admin_session")).toBe(false);

  await page.getByLabel("Usuario").fill("owner-browser-fixture");
  await page.getByLabel("Contraseña").fill("password-browser-fixture");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === "admin_session" && cookie.httpOnly && cookie.sameSite === "Strict")).toBe(true);

  await page.getByRole("link", { name: "Oportunidades" }).click();
  await expect(page).toHaveURL(/\/admin\/marketplace$/);
  await expect(page.getByRole("heading", { name: "Revisión de oportunidades" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar registros" })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === "admin_session")).toBe(true);
});

test("moderation cards, filters, confirmations and feedback work on desktop and mobile", async ({ page }) => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const now = "2026-10-13T12:00:00Z";
  const base = { category: "limpieza", city: "Santiago", scope: "Limpieza de cocina y baños.", specification: { answers: { property: "Casa", tasks: "Cocina y baños" }, requirements: "Traer guantes" }, timing_note: "Sábado por la mañana", duration_note: "4 horas", compensation_kind: "budget", compensation_min: 1500, compensation_max: null, compensation_unit: "task", created_at: now, expires_at: "2026-11-13T12:00:00Z", starts_at: null, duration_minutes: null };
  const rows = [{ ...base, id: first, status: "draft", moderation_status: "pending" }, { ...base, id: second, status: "draft", moderation_status: "pending" }];
  let fail = true;
  let deleteFail = true;
  const posts: { id: string; approve?: boolean; privacyReviewed?: boolean; action?: string; confirmId?: string }[] = [];
  await page.route("**/api/admin/marketplace", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { opportunities: rows, counts: { pending: rows.filter(r => r.moderation_status === "pending").length, approved: rows.filter(r => r.moderation_status === "approved").length, rejected: rows.filter(r => r.moderation_status === "rejected").length }, reports: [] } });
    const body = route.request().postDataJSON();
    posts.push(body);
    if (body.action === "delete") {
      expect(body.confirmId).toBe(body.id);
      if (deleteFail) { deleteFail = false; return route.fulfill({ status: 503, json: { error: "No se pudo eliminar la oportunidad de forma segura." } }); }
      // Keep GET deliberately stale: the selected card must disappear as soon as POST confirms deletion.
      return route.fulfill({ json: { saved: true } });
    }
    if (fail) { fail = false; return route.fulfill({ status: 409, json: { error: "No se confirmó la revisión. Recarga antes de reintentar." } }); }
    const row = rows.find(r => r.id === body.id)!;
    row.moderation_status = body.approve ? "approved" : "rejected";
    row.status = body.approve ? "open" : "closed";
    return route.fulfill({ json: { saved: true } });
  });
  await page.goto("http://localhost:3188/admin/login");
  await page.getByLabel("Usuario").fill("owner-browser-fixture");
  await page.getByLabel("Contraseña").fill("password-browser-fixture");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("http://localhost:3188/admin/marketplace");
  await expect(page.getByRole("heading", { name: "Moderación de oportunidades" })).toBeVisible();
  await expect(page.locator(".moderation-card")).toHaveCount(2);
  await expect(page.getByText("Limpieza de cocina y baños.").first()).toBeVisible();
  await expect(page.getByText("Sábado por la mañana").first()).toBeVisible();
  await expect(page.getByText("RD$1,500 por trabajo").first()).toBeVisible();
  await expect(page.getByText(/Enviada/).first()).toBeVisible();
  await expect(page.getByText(/Vence/).first()).toBeVisible();
  const firstCard = page.locator(".moderation-card").first();
  await expect(firstCard.getByRole("button", { name: "Aprobar y publicar" })).toBeDisabled();
  await firstCard.getByRole("checkbox").check();
  await firstCard.getByRole("button", { name: "Aprobar y publicar" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect(posts).toHaveLength(0);
  await firstCard.getByRole("button", { name: "Aprobar y publicar" }).click();
  await page.getByRole("button", { name: "Sí, aprobar y publicar" }).click();
  await expect(page.locator(".moderation-notice")).toContainText("No se confirmó");
  await firstCard.getByRole("checkbox").check();
  await firstCard.getByRole("button", { name: "Aprobar y publicar" }).click();
  await page.getByRole("button", { name: "Sí, aprobar y publicar" }).click();
  await expect(page.locator(".moderation-notice")).toContainText("Oportunidad aprobada");
  expect(posts[1]).toMatchObject({ id: first, approve: true, privacyReviewed: true });
  await page.locator(".moderation-card").first().getByRole("button", { name: "Rechazar" }).click();
  await page.getByRole("button", { name: "Sí, rechazar" }).click();
  await expect(page.locator(".moderation-notice")).toContainText("Oportunidad rechazada");
  await page.getByRole("button", { name: /Aprobadas 1/ }).click();
  await expect(page.locator(".moderation-card")).toHaveCount(1);
  await page.getByRole("button", { name: /Rechazadas 1/ }).click();
  await expect(page.locator(".moderation-card")).toHaveCount(1);
  await page.locator(".moderation-card").getByRole("button", { name: `Eliminar oportunidad ${second}` }).click();
  await expect(page.getByRole("dialog")).toContainText(second);
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".moderation-card")).toHaveCount(1);
  await page.locator(".moderation-card").getByRole("button", { name: `Eliminar oportunidad ${second}` }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(page.locator(".moderation-notice--error")).toContainText("No se pudo eliminar");
  await expect(page.locator(".moderation-card")).toHaveCount(1);
  await page.locator(".moderation-card").getByRole("button", { name: `Eliminar oportunidad ${second}` }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(page.locator(".moderation-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Rechazadas 0/ })).toBeVisible();
  await expect(page.locator(".moderation-notice:not(.moderation-notice--error)")).toContainText("Oportunidad eliminada");
  await expect(page.getByRole("heading", { name: "Verificación de cuentas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("pending request deletion affects only the confirmed request", async ({ page }) => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const rows = [first, second].map(id => ({ id, category: "limpieza", city: "Santiago",
    scope: "Limpieza de cocina y baños.", specification: {}, timing_note: "Flexible", duration_note: "Un día",
    compensation_kind: "negotiable", compensation_min: null, compensation_max: null, compensation_unit: null,
    created_at: "2026-10-13T12:00:00Z", expires_at: "2026-11-13T12:00:00Z", starts_at: null,
    duration_minutes: null, status: "draft", moderation_status: "pending" }));
  const posts: string[] = [];
  let fail = true;
  await page.route("**/api/admin/marketplace", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: {
      opportunities: rows, counts: { pending: 2, approved: 0, rejected: 0 }, reports: [] } });
    const body = route.request().postDataJSON();
    posts.push(body.id);
    expect(body).toMatchObject({ action: "delete", id: first, confirmId: first });
    if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: "No se pudo eliminar la oportunidad de forma segura." } }); }
    return route.fulfill({ json: { saved: true } });
  });
  await page.goto("http://localhost:3188/admin/login");
  await page.getByLabel("Usuario").fill("owner-browser-fixture");
  await page.getByLabel("Contraseña").fill("password-browser-fixture");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("http://localhost:3188/admin/marketplace");
  await expect(page.locator(".moderation-card")).toHaveCount(2);
  await page.getByRole("button", { name: `Eliminar oportunidad ${first}` }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect(posts).toHaveLength(0);
  await page.getByRole("button", { name: `Eliminar oportunidad ${first}` }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(page.locator(".moderation-notice--error")).toContainText("No se pudo eliminar");
  await expect(page.locator(".moderation-card")).toHaveCount(2);
  await page.getByRole("button", { name: `Eliminar oportunidad ${first}` }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(page.getByRole("button", { name: `Eliminar oportunidad ${first}` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Eliminar oportunidad ${second}` })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pendientes 1/ })).toBeVisible();
  expect(posts).toEqual([first, first]);
});
