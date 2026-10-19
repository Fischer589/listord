import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkerContactWhatsAppUrl, workerContactMessage } from "../lib/whatsapp";

const message = "¡Hola! 👋 Encontré tu perfil en ListoRD y me gustaría conversar contigo sobre una oportunidad de trabajo. ¿Tienes disponibilidad para que hablemos de los detalles?";

test("paid worker handoff encodes the approved invitation without implying availability", () => {
  assert.equal(workerContactMessage("  Ana María Pérez  "), message);
  const url = buildWorkerContactWhatsAppUrl("+1 (809) 555-0100", "  Ana María Pérez  ");
  assert.ok(url);
  assert.equal(new URL(url).pathname, "/18095550100");
  assert.equal(new URL(url).searchParams.get("text"), message);
  assert.match(url, /%C2%A1Hola!/);
  assert.equal(buildWorkerContactWhatsAppUrl("invalid", "Ana"), null);
});

test("paid worker handoff uses the same greeting when a first name is unavailable", () => {
  assert.equal(workerContactMessage("  "), message);
});

test("worker names never change the approved message or break URL encoding", () => {
  const url = buildWorkerContactWhatsAppUrl("18095550100", "  José María ");
  assert.ok(url);
  assert.equal(new URL(url).searchParams.get("text"), message);
  assert.doesNotMatch(url, /�|%EF%BF%BD/);
  assert.match(url, /%F0%9F%91%8B/);
  for (const damagedName of ["Jos� Pérez", `Jose\uD800 Pérez`]) {
    const repaired = buildWorkerContactWhatsAppUrl("18095550100", damagedName);
    assert.ok(repaired);
    assert.equal(new URL(repaired).searchParams.get("text"), message);
    assert.doesNotMatch(repaired, /%EF%BF%BD/);
  }
});
