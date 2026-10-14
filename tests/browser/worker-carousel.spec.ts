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
    await previous.click();
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

test("anonymous directory contact offers both products and carries the selected worker", async ({ page }) => {
  await page.goto("/");
  const firstCard = page.locator(".wc").first();
  await firstCard.getByRole("button", { name: "Contactar trabajador" }).click();
  const paywall = page.getByRole("dialog", { name: "¿Ya encontraste a quien necesitas?" });
  await expect(paywall).toBeVisible();
  await expect(paywall.getByText("Perfil seleccionado: Limpieza · Santiago")).toBeVisible();
  await expect(paywall.getByText("Elige cómo quieres conectar con los trabajadores de ListoRD.")).toBeVisible();
  await expect(paywall.getByText("RD$89", { exact: true })).toBeVisible();
  await expect(paywall.getByText("RD$299 / 30 días")).toBeVisible();
  await expect(paywall.getByText("4 contactos individuales = RD$356.")).toBeVisible();
  const direct = paywall.getByRole("link", { name: "Contactar por RD$89" });
  await expect(direct).toHaveAttribute("href", "/empleadores/contacto?worker=00000000-0000-4000-8000-000000000001");
  const cta = paywall.getByRole("link", { name: "Desbloquear 30 días — RD$299" });
  const [directBox, workspaceBox] = await Promise.all([
    paywall.locator(".contact-paywall__offer").first().boundingBox(),
    paywall.locator(".contact-paywall__offer").last().boundingBox(),
  ]);
  if (page.viewportSize()!.width < 640) expect(workspaceBox!.y).toBeGreaterThan(directBox!.y + directBox!.height);
  else expect(workspaceBox!.x).toBeGreaterThan(directBox!.x + directBox!.width);
  const ctaBox = await cta.boundingBox();
  expect(ctaBox && ctaBox.height >= 44).toBeTruthy();
  await expect(cta).toHaveAttribute("href", "/empleadores/pago?worker=00000000-0000-4000-8000-000000000001");
  await cta.click();
  await expect(page).toHaveURL(/\/empleadores\/pago\?worker=00000000-0000-4000-8000-000000000001$/);
  await expect(page.getByRole("heading", { name: "¿Encontraste a la persona indicada?" })).toBeVisible();
  await expect(page.getByText("Un solo pago. Acceso a contactos durante 30 días. Sin renovación automática.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("RD$89 selection retains the worker through employer verification without opening checkout", async ({ page }) => {
  await page.goto("/");
  await page.locator(".wc").first().getByRole("button", { name: "Contactar trabajador" }).click();
  const direct = page.getByRole("dialog", { name: "¿Ya encontraste a quien necesitas?" })
    .getByRole("link", { name: "Contactar por RD$89" });
  await direct.scrollIntoViewIfNeeded();
  const hit = await direct.evaluate(element => {
    const box = element.getBoundingClientRect();
    const atPoint = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { direct: atPoint === element, tag: atPoint?.tagName, text: atPoint?.textContent?.slice(0, 90), x: box.x, y: box.y };
  });
  expect(hit, JSON.stringify(hit)).toMatchObject({ direct: true });
  await direct.click();
  await expect(page).toHaveURL(/\/empleadores\/contacto\?worker=00000000-0000-4000-8000-000000000001$/);
  await expect(page.getByRole("heading", { name: "¿Ya encontraste a quien necesitas?" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Resumen del contacto directo" }).getByText("RD$89")).toBeVisible();
  await expect(page.getByText("Un pago. Un contacto. Sin renovación automática.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verifica tu correo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
