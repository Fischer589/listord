import { expect, test } from "@playwright/test";

test.skip(process.env.WORKER_CAROUSEL_FIXTURE !== "1", "Uses the isolated worker carousel server fixture.");

test("profile arrows are visible, keyboard operable, bounded, and keep mobile swipe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "Perfiles de trabajadores revisados" });
  const previous = page.getByRole("button", { name: "Perfil anterior" });
  const next = page.getByRole("button", { name: "Perfil siguiente" });
  const slides = carousel.locator(".discovery-slide");
  await expect(slides).toHaveCount(5);
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(next).toHaveAttribute("aria-controls", "worker-discovery-carousel");
  const [carouselBox, previousBox, nextBox] = await Promise.all([carousel.boundingBox(), previous.boundingBox(), next.boundingBox()]);
  expect(carouselBox && previousBox && nextBox).toBeTruthy();
  expect(previousBox!.width).toBeGreaterThanOrEqual(44);
  expect(nextBox!.height).toBeGreaterThanOrEqual(44);
  if (page.viewportSize()!.width >= 640) {
    expect(previousBox!.x + previousBox!.width).toBeLessThan(carouselBox!.x);
    expect(nextBox!.x).toBeGreaterThan(carouselBox!.x + carouselBox!.width);
  } else {
    expect(previousBox!.y).toBeGreaterThanOrEqual(carouselBox!.y + carouselBox!.height);
  }

  await next.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(previous).toBeDisabled();

  if (page.viewportSize()!.width < 640) {
    await carousel.scrollIntoViewIfNeeded();
    const box = (await carousel.boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const y = Math.max(80, Math.min(page.viewportSize()!.height - 80, box.y + 120));
    const start = box.x + box.width * 0.8;
    const end = box.x + box.width * 0.2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start, y }] });
    for (let step = 1; step <= 5; step++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start + (end - start) * step / 5, y }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    for (let step = 0; step < 5 && await previous.isEnabled(); step++) {
      const before = await carousel.evaluate(element => element.scrollLeft);
      await previous.click();
      await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBeLessThan(before);
    }
    await expect(previous).toBeDisabled();
  }

  for (let step = 0; step < 5 && await next.isEnabled(); step++) {
    const before = await carousel.evaluate(element => element.scrollLeft);
    await next.click();
    await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBeGreaterThan(before);
  }
  await expect(next).toBeDisabled();
  const lastCard = (await slides.last().boundingBox())!;
  const visibleArea = (await carousel.boundingBox())!;
  expect(lastCard.x).toBeLessThan(visibleArea.x + visibleArea.width);
  expect(lastCard.x + lastCard.width).toBeGreaterThan(visibleArea.x);

  for (let step = 0; step < 5 && await previous.isEnabled(); step++) await previous.click();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("anonymous directory contact offers three credit packs and carries the selected worker", async ({ page }) => {
  await page.goto("/");
  const firstCard = page.locator(".wc").first();
  await firstCard.getByRole("button", { name: "Conectar por WhatsApp" }).click();
  const paywall = page.getByRole("dialog", { name: "¿Listo para terminar tu búsqueda? 🎯" });
  await expect(paywall).toBeVisible();
  await expect(paywall.getByText("Perfil seleccionado: Limpieza · Santiago")).toBeVisible();
  for (const price of ["RD$100", "RD$445", "RD$890"]) await expect(paywall.getByText(price, { exact: true })).toBeVisible();
  const offers = paywall.locator(".contact-paywall__offer");
  await expect(offers).toHaveCount(3);
  const [first, second, last] = await Promise.all([offers.first().boundingBox(), offers.nth(1).boundingBox(), offers.last().boundingBox()]);
  if (page.viewportSize()!.width < 640) {
    expect(second!.y).toBeGreaterThan(first!.y + first!.height);
    expect(last!.y).toBeGreaterThan(second!.y + second!.height);
  } else {
    expect(second!.x).toBeGreaterThan(first!.x + first!.width);
    expect(last!.y).toBeGreaterThan(first!.y + first!.height);
  }
  const cta = paywall.getByRole("link", { name: "Ver mis créditos y conectar" });
  await expect(cta).toHaveAttribute("href", "/empleadores/contacto?worker=00000000-0000-4000-8000-000000000001");
  const ctaBox = await cta.boundingBox();
  expect(ctaBox && ctaBox.height >= 44).toBeTruthy();
  await cta.click();
  await expect(page).toHaveURL(/\/empleadores\/contacto\?worker=00000000-0000-4000-8000-000000000001$/);
  await expect(page.getByRole("heading", { name: "Conecta con el talento que elegiste" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("credit selection retains the worker through employer verification without opening checkout", async ({ page }) => {
  await page.goto("/");
  await page.locator(".wc").first().getByRole("button", { name: "Conectar por WhatsApp" }).click();
  const cta = page.getByRole("dialog", { name: "¿Listo para terminar tu búsqueda? 🎯" })
    .getByRole("link", { name: "Ver mis créditos y conectar" });
  await cta.scrollIntoViewIfNeeded();
  const hit = await cta.evaluate(element => {
    const box = element.getBoundingClientRect();
    const atPoint = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { direct: atPoint === element, tag: atPoint?.tagName, text: atPoint?.textContent?.slice(0, 90), x: box.x, y: box.y };
  });
  expect(hit, JSON.stringify(hit)).toMatchObject({ direct: true });
  await cta.click();
  await expect(page).toHaveURL(/\/empleadores\/contacto\?worker=00000000-0000-4000-8000-000000000001$/);
  await expect(page.getByRole("heading", { name: "Conecta con el talento que elegiste" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
