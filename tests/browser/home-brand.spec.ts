import { expect, test } from "@playwright/test";

const slogan = "Encuentra. Conecta. Contrata.";

test("homepage keeps the brand statement beside the hero on desktop and near the main content on mobile", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".hero");
  const statement = page.getByRole("complementary", { name: "La visión de ListoRD" });
  const quote = statement.getByText(slogan, { exact: true });
  const title = hero.getByRole("heading", { level: 1 });
  const primary = hero.getByRole("link", { name: "Encontrar mi próximo empleado" });
  await expect(quote).toBeVisible();
  await expect(statement).toContainText("Nuestra razón de ser");
  await expect(primary).toHaveAttribute("href", "/solicitar");
  await expect(hero.getByRole("link", { name: "Busco trabajo" })).toHaveAttribute("href", "/trabajadores/registro");
  await expect(page.getByRole("link", { name: /Limpieza/ }).first()).toBeVisible();

  const [statementBox, titleBox, actionsBox, heroBox, primaryBox] = await Promise.all([
    statement.boundingBox(), title.boundingBox(), hero.locator(".hero-actions").boundingBox(), hero.boundingBox(), primary.boundingBox()
  ]);
  expect(statementBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(primaryBox).not.toBeNull();
  const viewport = page.viewportSize()!;
  if (viewport.width >= 900) {
    expect(statementBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width - 10);
    expect(statementBox!.y).toBeLessThan(heroBox!.y + heroBox!.height);
  } else {
    expect(statementBox!.y).toBeGreaterThan(actionsBox!.y + actionsBox!.height);
    expect(statementBox!.y).toBeLessThan(heroBox!.y + heroBox!.height);
    expect(primaryBox!.y + primaryBox!.height).toBeLessThanOrEqual(viewport.height);
    const headerCta = page.getByRole("banner").getByRole("link", { name: "Encontrar mi próximo empleado" });
    const [logoBox, headerCtaBox, menuBox] = await Promise.all([
      page.getByRole("banner").getByRole("link", { name: "ListoRD — Inicio" }).boundingBox(),
      headerCta.boundingBox(), page.getByRole("button", { name: "Abrir menú" }).boundingBox()
    ]);
    expect(headerCtaBox!.x).toBeGreaterThanOrEqual(logoBox!.x + logoBox!.width);
    expect(headerCtaBox!.x + headerCtaBox!.width).toBeLessThanOrEqual(menuBox!.x);
    expect(await headerCta.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  expect(await quote.evaluate(element => {
    const style = getComputedStyle(element);
    return Number.parseFloat(style.fontSize) >= 29 && style.visibility === "visible";
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("category discovery keeps free browsing and the contact price clear", async ({ page }) => {
  await page.goto("/categorias/limpiadora");
  await expect(page.getByRole("heading", { level: 1, name: "¿Buscas limpiadoras?" })).toBeVisible();
  await expect(page.locator(".cat-desc")).toContainText("Revisa perfiles de limpiadoras gratis");
  await expect(page.locator(".cat-trust-row")).toContainText("Contacto desde RD$100");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /confirma la disponibilidad directamente/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
