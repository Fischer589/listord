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

test("an anonymous contact attempt preserves the selected worker without requesting a phone", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const oldFetch = globalThis.fetch;
  const entries = new Map<string, string>();
  const opened: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { assign: (url: string) => { opened.push(url); } } } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } } });
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/analytics/events") return Response.json({ ok: true });
    assert.fail(`Anonymous contact reached ${String(input)} ${String(init?.method)}`);
  };
  try {
    const id = "22222222-2222-4222-8222-222222222222";
    assert.equal(await openFreeWorkerContact(id), "paywall");
    assert.equal((JSON.parse(entries.get("listord-selected-worker-v1")!) as {id: string}).id, id);
    const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: {
      property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo"
    }, timing: "15 de octubre", duration: "4 horas", amount: "1500" };
    assert.equal(await openFreeWorkerContact(id, draft), "paywall");
    assert.equal(opened.length, 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
