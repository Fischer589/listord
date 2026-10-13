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
  const posts: { id: string; approve: boolean; privacyReviewed?: boolean }[] = [];
  await page.route("**/api/admin/marketplace", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { opportunities: rows, counts: { pending: rows.filter(r => r.moderation_status === "pending").length, approved: rows.filter(r => r.moderation_status === "approved").length, rejected: rows.filter(r => r.moderation_status === "rejected").length }, reports: [] } });
    const body = route.request().postDataJSON();
    posts.push(body);
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
  await expect(page.getByRole("heading", { name: "Verificación de cuentas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
