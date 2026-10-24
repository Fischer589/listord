import { expect, test, type Locator } from "@playwright/test";

test("pending worker rejection confirms, handles failure, and persists without touching other cards", async ({ page }, testInfo) => {
  const selected = testInfo.project.name === "desktop"
    ? "11111111-1111-4111-8111-111111111111"
    : "44444444-4444-4444-8444-444444444444";
  const other = testInfo.project.name === "desktop"
    ? "22222222-2222-4222-8222-222222222222"
    : "55555555-5555-4555-8555-555555555555";

  await page.goto("http://localhost:3188/admin/login");
  await page.getByLabel("Usuario").fill("owner-browser-fixture");
  await page.getByLabel("Contraseña").fill("password-browser-fixture");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("http://localhost:3188/admin/workers?status=pending");

  const selectedCard = page.locator(`[data-worker-id="${selected}"]`);
  const otherCard = page.locator(`[data-worker-id="${other}"]`);
  const rejectButton = selectedCard.getByRole("button", { name: "Rechazar y eliminar" });
  async function press(button: Locator) {
    if (testInfo.project.name === "mobile") {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    } else {
      await button.click();
    }
  }
  async function openConfirmation() {
    await rejectButton.evaluate(button => button.scrollIntoView({ block: "center", behavior: "instant" }));
    await press(rejectButton);
  }
  await expect(selectedCard).toBeVisible();
  await expect(otherCard).toBeVisible();
  await openConfirmation();
  await expect(page.getByRole("dialog")).toContainText("El perfil y cualquier historial relacionado se conservarán.");
  await press(page.getByRole("button", { name: "Cancelar" }));
  await expect(selectedCard).toBeVisible();

  await openConfirmation();
  await press(page.getByRole("button", { name: "Sí, rechazar y eliminar" }));
  await expect(selectedCard.getByRole("alert")).toContainText("No se pudo rechazar el registro");
  await expect(selectedCard).toBeVisible();
  await expect(otherCard).toBeVisible();

  await openConfirmation();
  await press(page.getByRole("button", { name: "Sí, rechazar y eliminar" }));
  await expect(selectedCard).toHaveCount(0);
  await expect(otherCard).toBeVisible();
  await page.reload();
  await expect(selectedCard).toHaveCount(0);
  await expect(otherCard).toBeVisible();
  await page.goto("http://localhost:3188/admin/workers?status=approved");
  await expect(page.getByRole("heading", { name: "Perfil aprobado" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
