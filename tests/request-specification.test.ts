import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES } from "../lib/categories";
import { changeCategory, emptyRequest, REQUEST_SCHEMAS, requestSummary, validateRequest, type RequestDraft } from "../lib/request-specification";

function complete(category: string): RequestDraft {
  return { ...emptyRequest(), category, city: "Puerto Plata", answers: Object.fromEntries(REQUEST_SCHEMAS[category].map(q => [q.id, q.options?.[0] ?? "Detalle del trabajo"])), timing: "15 de octubre, 9:00 a. m.", duration: "4 horas", amount: "1500" };
}
test("schemas cover exactly the existing 14 categories without inventing taxonomy", () => {
  assert.equal(CATEGORIES.length, 14);
  assert.deepEqual(Object.keys(REQUEST_SCHEMAS).sort(), CATEGORIES.map(c => c.searchKey).sort());
});
for (const category of CATEGORIES) {
  test(`${category.label}: complete request, missing scope, invalid choices and Spanish preview`, () => {
    const draft = complete(category.searchKey);
    assert.deepEqual(validateRequest(draft), {});
    const summary = requestSummary(draft);
    assert.ok(summary.startsWith(category.label.toLocaleUpperCase("es-DO")));
    assert.match(summary, /Puerto Plata/);
    assert.match(summary, /Presupuesto: RD\$1[,.]500 por trabajo/);
    assert.match(summary, /4 horas/);
    for (const q of REQUEST_SCHEMAS[category.searchKey]) {
      assert.ok(validateRequest({ ...draft, answers: { ...draft.answers, [q.id]: "" } })[q.id]);
      if (q.options) assert.ok(validateRequest({ ...draft, answers: { ...draft.answers, [q.id]: "inventado" } })[q.id]);
    }
  });
}
test("progressive validation, bounds and compensation reject malformed terms", () => {
  assert.ok(validateRequest(emptyRequest(), 0).category);
  assert.ok(validateRequest(emptyRequest(), 0).city);
  assert.deepEqual(validateRequest({ ...emptyRequest(), category: "limpieza", city: "Moca" }, 0), {});
  const draft = complete("limpieza");
  for (const amount of ["0", "-1", "1e3", "Infinity", "NaN", "1.999", "299 USD", "100000000"]) assert.ok(validateRequest({ ...draft, amount }).amount);
  assert.ok(validateRequest({ ...draft, timing: " " }).timing);
  assert.ok(validateRequest({ ...draft, city: "a".repeat(101) }).city);
  assert.ok(validateRequest({ ...draft, requirements: "a".repeat(301) }).requirements);
  assert.ok(validateRequest({ ...draft, category: "constructor" }).category);
  assert.ok(validateRequest({ ...draft, category: "__proto__" }).category);
  assert.ok(validateRequest({ ...draft, unit: "USD" }).unit);
  assert.deepEqual(validateRequest({ ...draft, compensation: "negotiable", amount: "" }), {});
});
test("category changes clear stale scope while retaining known common terms", () => {
  const draft = complete("limpieza");
  const changed = changeCategory(draft, "plomeria");
  assert.deepEqual(changed.answers, {});
  assert.equal(changed.city, draft.city);
  assert.equal(changed.timing, draft.timing);
  assert.equal(changed.amount, draft.amount);
  assert.equal(draft.answers.property, "Casa");
});
test("summary labels unknown terms and ignores off-schema/private keys", () => {
  const draft = { ...complete("limpieza"), answers: { tasks: "Pisos y baños", phone: "PRIVATE", exact_address: "SECRET" }, compensation: "negotiable" as const, amount: "1500", timing: "", duration: "", exclusions: "Cocinar", requirements: "Traer guantes" };
  const summary = requestSummary(draft);
  assert.match(summary, /Fecha y horario: Por acordar/);
  assert.match(summary, /Duración: Por acordar/);
  assert.match(summary, /Pago: por acordar/);
  assert.match(summary, /No incluye: Cocinar/);
  assert.match(summary, /Requisitos: Traer guantes/);
  assert.doesNotMatch(summary, /PRIVATE|SECRET|1500|verificad|interesad/i);
  assert.match(requestSummary(emptyRequest()), /SERVICIO POR DEFINIR/);
});
