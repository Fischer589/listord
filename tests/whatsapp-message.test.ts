import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkerContactWhatsAppUrl, workerContactMessage } from "../lib/whatsapp";

const message = "¡Hola, Ana! 👋 Vi tu perfil en ListoRD y me llamó la atención. Me gustaría conversar contigo sobre una oportunidad de trabajo. ¿Estás disponible para hablar? 😊";

test("paid worker handoff uses the first name and encodes the complete message", () => {
  assert.equal(workerContactMessage("  Ana María Pérez  "), message);
  const url = buildWorkerContactWhatsAppUrl("+1 (809) 555-0100", "  Ana María Pérez  ");
  assert.ok(url);
  assert.equal(new URL(url).pathname, "/18095550100");
  assert.equal(new URL(url).searchParams.get("text"), message);
  assert.match(url, /%C2%A1Hola%2C%20Ana!/);
  assert.equal(buildWorkerContactWhatsAppUrl("invalid", "Ana"), null);
});

test("paid worker handoff has a natural greeting when a first name is unavailable", () => {
  assert.equal(workerContactMessage("  "), message.replace("¡Hola, Ana!", "¡Hola!"));
});

test("Unicode employer greeting survives URL encoding and rejects damaged stored names", () => {
  const url = buildWorkerContactWhatsAppUrl("18095550100", "  José María ");
  assert.ok(url);
  assert.equal(new URL(url).searchParams.get("text"), message.replace("Ana", "José"));
  assert.doesNotMatch(url, /�|%EF%BF%BD/);
  assert.match(url, /%F0%9F%91%8B/);
  assert.match(url, /%F0%9F%98%8A/);
  for (const damagedName of ["Jos� Pérez", `Jose\uD800 Pérez`]) {
    const repaired = buildWorkerContactWhatsAppUrl("18095550100", damagedName);
    assert.ok(repaired);
    assert.equal(new URL(repaired).searchParams.get("text"), message.replace("¡Hola, Ana!", "¡Hola!"));
    assert.doesNotMatch(repaired, /%EF%BF%BD/);
  }
});
