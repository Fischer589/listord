import { expect, test } from "@playwright/test";
import { CATEGORIES } from "../../lib/categories";
import { REQUEST_SCHEMAS } from "../../lib/request-specification";

test("anonymous request, validation, keyboard focus, preview and editing", async ({ page, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Necesito personal", exact: true }).click();
  await expect(page).toHaveURL(/\/solicitar$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  await expect(page.locator("#category")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel(/^¿Qué necesitas\?/).selectOption("limpieza");
  await page.getByLabel(/^¿Dónde\?/).fill("Puerto Plata");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("¿Qué espacio necesitas limpiar?")).toBeFocused();
  await page.getByLabel("¿Qué espacio necesitas limpiar?").selectOption("Casa");
  await page.getByLabel("Tareas y tamaño aproximado del espacio").fill("Pisos y baños, 2 habitaciones");
  await page.getByLabel("Productos y utensilios").selectOption("Los pongo yo");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Fecha y horario", { exact: true }).fill("15 de octubre, 9:00 a. m.");
  await page.getByLabel("Duración o frecuencia").fill("4 horas");
  await page.getByLabel("Monto en RD$").fill("1500");
  await page.getByLabel("Tareas que no incluye (opcional)").fill("Cocinar ni lavar ropa");
  await page.getByRole("button", { name: "Ver mi solicitud" }).click();
  const preview = page.getByRole("article", { name: "Resumen de la solicitud" });
  await expect(preview).toContainText("LIMPIEZA");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("preview.png"), fullPage: true });
  await expect(preview).toContainText("Presupuesto: RD$1,500 por trabajo");
  await expect(preview).toContainText("No incluye: Cocinar ni lavar ropa");
  await page.getByRole("button", { name: "Copiar resumen" }).click();
  await expect(page.getByRole("status")).toHaveText("Resumen copiado.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Pisos y baños, 2 habitaciones");
  await expect(page.getByRole("link", { name: "Explorar perfiles" })).toHaveAttribute("href", /skill=limpieza&city=Puerto\+Plata/);
  await page.getByRole("button", { name: "Editar fecha y pago" }).click();
  await expect(page.getByLabel("Monto en RD$")).toHaveValue("1500");
  await page.getByRole("combobox", { name: "Pago", exact: true }).selectOption("negotiable");
  await page.getByRole("button", { name: "Ver mi solicitud" }).click();
  await expect(preview).toContainText("Pago: por acordar");
  await expect(preview).not.toContainText("1,500");
  await page.getByRole("button", { name: "Editar servicio y lugar" }).click();
  await page.getByLabel(/^¿Qué necesitas\?/).selectOption("plomeria");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Problema y pieza afectada")).toHaveValue("");
  await expect(page.getByText("Pisos y baños, 2 habitaciones")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

for (const category of CATEGORIES) {
  test(`${category.label}: anonymous category-specific preview`, async ({ page }) => {
    await page.goto("/solicitar");
    await page.locator("#category").selectOption(category.searchKey);
    await page.locator("#city").fill("Moca");
    await page.getByRole("button", { name: "Continuar" }).click();
    for (const question of REQUEST_SCHEMAS[category.searchKey]) {
      if (question.options) await page.locator(`#${question.id}`).selectOption(question.options[0]);
      else await page.locator(`#${question.id}`).fill("Detalle necesario del trabajo");
    }
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.locator("#timing").fill("Fecha flexible, por acordar");
    await page.locator("#duration").fill("A estimar tras la visita");
    await page.locator("#compensation").selectOption("negotiable");
    await page.getByRole("button", { name: "Ver mi solicitud" }).click();
    await expect(page.getByRole("article")).toContainText(category.label.toLocaleUpperCase("es-DO"));
    await expect(page.getByRole("article")).toContainText("Pago: por acordar");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
