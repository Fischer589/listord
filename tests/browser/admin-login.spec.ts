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
