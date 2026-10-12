import assert from "node:assert/strict";
import test from "node:test";
import { storeDiscoveryRequest, storeProfileRequest, takeDiscoveryRequest, takeProfileRequest } from "../lib/contact-context";
import { emptyRequest } from "../lib/request-specification";
import { openFreeWorkerContact } from "../lib/free-contact";

test("request context stays in the browser tab, follows only its intended destination and worker, then expires", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const entries = new Map<string, string>();
  const location = { origin: "https://listordapp.com", pathname: "/solicitar", search: "", hash: "" };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  } });
  try {
    const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: {
      property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo"
    }, timing: "15 de octubre", duration: "4 horas", amount: "1500", exclusions: "Cocinar" };
    const href = "/?skill=limpieza&city=Puerto+Plata#descubre";
    storeDiscoveryRequest(draft, href);
    assert.ok(!href.includes("Pisos") && !href.includes("Cocinar"));
    location.pathname = "/";
    location.search = "?skill=limpieza&city=Puerto+Plata";
    location.hash = "#descubre";
    assert.deepEqual(takeDiscoveryRequest(), draft);
    assert.equal(takeDiscoveryRequest(), null);

    storeDiscoveryRequest(draft, href);
    location.search = "";
    assert.equal(takeDiscoveryRequest(), null);
    location.search = "?skill=limpieza&city=Puerto+Plata";
    assert.equal(takeDiscoveryRequest(), null);

    const chosen = "22222222-2222-4222-8222-222222222222";
    storeProfileRequest(draft, chosen);
    assert.equal(takeProfileRequest("33333333-3333-4333-8333-333333333333"), null);
    storeProfileRequest(draft, chosen);
    assert.deepEqual(takeProfileRequest(chosen), draft);
    assert.equal(takeProfileRequest(chosen), null);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("direct browsing keeps its generic message while a request keeps the server-verified worker message", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const oldFetch = globalThis.fetch;
  const payloads: unknown[] = [];
  const opened: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { assign: (url: string) => { opened.push(url); } } } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "fixture-session" } });
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/analytics/events") return Response.json({ ok: true });
    assert.equal(String(input), "/api/workers/contact");
    payloads.push(JSON.parse(String(init?.body)));
    return Response.json({ url: "https://wa.me/18095550100?text=Hola%20Fixture%20Worker%2C%20mensaje%20verificado" });
  };
  try {
    const id = "22222222-2222-4222-8222-222222222222";
    await openFreeWorkerContact(id, "Fixture Worker", "limpieza");
    assert.deepEqual(payloads[0], { workerId: id });
    assert.equal(new URL(opened[0]).searchParams.get("text"), "Hola Fixture, te encontré en ListoRD. Necesito un(a) limpieza. ¿Podemos confirmar tareas, horario y pago?");
    const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: {
      property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo"
    }, timing: "15 de octubre", duration: "4 horas", amount: "1500" };
    await openFreeWorkerContact(id, "Fixture Worker", "limpieza", draft);
    assert.deepEqual(payloads[1], { workerId: id, draft });
    assert.equal(new URL(opened[1]).searchParams.get("text"), "Hola Fixture Worker, mensaje verificado");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
