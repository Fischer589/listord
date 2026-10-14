import assert from "node:assert/strict";
import test from "node:test";
import { publicWorkerFields, publicWorkerText } from "../lib/public-worker";

test("public worker previews remove contact text before HTML or JSON serialization", () => {
  const old = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  try {
  const row = publicWorkerFields({ full_name: "Ana +1 (809) 555-0100", city: "Santiago", skills: ["Limpieza", "whatsapp 18095550100"],
    short_intro: "Escríbeme a ana@example.com", experience: "Instagram @ana_worker", photo_url: "https://fixture.supabase.co/storage/v1/object/public/workers/photo.jpg" });
  assert.equal(row.full_name, "Trabajador ListoRD");
  assert.deepEqual(row.skills, ["Limpieza"]);
  assert.equal(row.short_intro, "");
  assert.equal(row.experience, "");
  assert.equal(row.photo_url, "https://fixture.supabase.co/storage/v1/object/public/workers/photo.jpg");
  assert.doesNotMatch(JSON.stringify(row), /18095550100|example\.com|@ana_worker/);
  assert.equal(publicWorkerText("wa.me/18095550100"), "");
  assert.equal(publicWorkerText("Electricista con experiencia"), "Electricista con experiencia");
  } finally { if (old === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = old; }
});
