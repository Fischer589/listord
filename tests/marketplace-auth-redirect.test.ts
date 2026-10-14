import assert from "node:assert/strict";
import test from "node:test";
import { marketplaceAuthCallbackUrl, marketplaceAuthDestination } from "../lib/marketplace-auth-redirect";
import { clearPendingPublicationDraft, savePendingPublicationDraft, takePendingPublicationDraft } from "../lib/pending-publication-draft";
import { emptyRequest } from "../lib/request-specification";

test("all ListoRD email intents use fixed local callback paths and never generate DefenderDesk links", () => {
  const origins = ["https://listordapp.com", "https://www.listordapp.com", "https://release-candidate--listord-2.netlify.app", "http://127.0.0.1:3188"];
  const intents = { publish: "/solicitar", apply: "/oportunidades", account: "/empleadores/mi-cuenta", direct: "/empleadores/contacto" } as const;
  for (const origin of origins) for (const [intent, destination] of Object.entries(intents)) {
    const url = marketplaceAuthCallbackUrl(intent as keyof typeof intents, origin);
    assert.equal(url, `${origin}/auth/callback/${intent}`);
    assert.equal(marketplaceAuthDestination(intent), destination);
    assert.doesNotMatch(url, /defenderdesk/i);
  }
  assert.equal(marketplaceAuthCallbackUrl("publish", "https://defenderdesk-web.vercel.app"), "https://listordapp.com/auth/callback/publish");
  assert.equal(marketplaceAuthCallbackUrl("apply", "javascript:alert(1)"), "https://listordapp.com/auth/callback/apply");
  assert.equal(marketplaceAuthDestination("https://evil.example"), null);
});

test("pending opportunity draft is tab-scoped, validated, time-limited and consumed once", () => {
  const data = new Map<string, string>();
  const originalStorage = globalThis.sessionStorage;
  const originalNow = Date.now;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }
  } });
  const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" }, timing: "Mañana", duration: "4 horas", amount: "1500" };
  try {
    assert.equal(savePendingPublicationDraft(draft), true);
    assert.deepEqual(takePendingPublicationDraft(), draft);
    assert.equal(takePendingPublicationDraft(), null);
    assert.equal(savePendingPublicationDraft(draft), true);
    clearPendingPublicationDraft();
    assert.equal(takePendingPublicationDraft(), null);
    assert.equal(savePendingPublicationDraft(draft), true);
    const savedAt = Date.now();
    Date.now = () => savedAt + 2 * 60 * 60_000 + 1;
    assert.equal(takePendingPublicationDraft(), null);
  } finally {
    Date.now = originalNow;
    if (originalStorage === undefined) delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
    else Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: originalStorage });
  }
});
