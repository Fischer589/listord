import { expect, test } from "@playwright/test";

const slogan = "Un negocio que gana dinero ayudando a otros a ganar el suyo.";

test("homepage keeps the brand statement beside the hero on desktop and near the main content on mobile", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".hero");
  const statement = page.getByRole("complementary", { name: "La visión de ListoRD" });
  const quote = statement.getByText(slogan, { exact: true });
  const title = hero.getByRole("heading", { level: 1 });
  await expect(quote).toBeVisible();
  await expect(statement).toContainText("Nuestra razón de ser");
  await expect(hero.getByRole("link", { name: "Necesito personal" })).toHaveAttribute("href", "/solicitar");
  await expect(hero.getByRole("link", { name: "Busco trabajo" })).toHaveAttribute("href", "/trabajadores/registro");
  await expect(page.getByRole("link", { name: /Limpieza/ }).first()).toBeVisible();

  const [statementBox, titleBox, actionsBox, heroBox] = await Promise.all([
    statement.boundingBox(), title.boundingBox(), hero.locator(".hero-actions").boundingBox(), hero.boundingBox()
  ]);
  expect(statementBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  const viewport = page.viewportSize()!;
  if (viewport.width >= 900) {
    expect(statementBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width - 10);
    expect(statementBox!.y).toBeLessThan(heroBox!.y + heroBox!.height);
  } else {
    expect(statementBox!.y).toBeGreaterThan(actionsBox!.y + actionsBox!.height);
    expect(statementBox!.y).toBeLessThan(heroBox!.y + heroBox!.height);
    expect(statementBox!.y).toBeLessThan(viewport.height);
  }
  expect(await quote.evaluate(element => {
    const style = getComputedStyle(element);
    return Number.parseFloat(style.fontSize) >= 29 && style.visibility === "visible";
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
