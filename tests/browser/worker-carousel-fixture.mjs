// Isolated Playwright server fixture. It replaces only read requests to the
// non-production Supabase hostname configured in playwright.config.ts.
const originalFetch = globalThis.fetch;
const workers = Array.from({ length: 5 }, (_, index) => ({
  id: "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
  full_name: "Perfil de prueba " + (index + 1),
  city: "Santiago",
  work_style: "hands_on",
  desired_income: 1500,
  short_intro: "Perfil de prueba para navegación del carrusel.",
  skills: ["Limpieza", "Cocina"],
  photo_url: null,
  created_at: "2026-10-01T00:00:00Z",
  available_now: true,
  rating_average: null,
  rating_count: 0,
  hired_count: 0,
  experience: null,
  income_type: "daily",
  last_boosted_at: null,
  boost_expires_at: null
}));

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "fixture.supabase.co" && url.pathname === "/rest/v1/workers" && (!init?.method || init.method === "GET")) {
    return Promise.resolve(Response.json(workers));
  }
  return originalFetch(input, init);
};
