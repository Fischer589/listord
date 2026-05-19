/**
 * Smart service matching for ListoRD worker search.
 * Handles synonym expansion for common Dominican service terms.
 */

/** Normalizes text: lowercase, strip accents, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dominican service synonym map.
 * Key   = canonical normalized search term (no accents, lowercase).
 * Value = related words and variants (all normalized).
 *
 * Add new entries here to expand search coverage — no other code changes needed.
 */
const SYNONYM_MAP: Readonly<Record<string, readonly string[]>> = {
  limpieza: [
    "limpiadora", "limpiador", "limpiar", "limpio",
    "cleaner", "casa", "hogar", "aseo", "domestica",
    "domestico", "domicilio", "mucama", "servicio domestico"
  ],
  cocina: [
    "cocinera", "cocinero", "cocinar", "chef",
    "comida", "gastronomia", "reposteria", "repostero",
    "panaderia", "pasteleria", "cafeteria", "restaurante"
  ],
  construccion: [
    "albanil", "albanila", "ayudante", "obra",
    "cemento", "constructor", "albanileria", "pared",
    "bloque", "mezcla", "edificacion", "remodelacion",
    "arreglo", "reparacion casa"
  ],
  plomeria: [
    "plomero", "plomera", "tuberia", "bano",
    "fuga", "fontanero", "instalacion agua", "griferia",
    "tubos", "cano", "sanitario", "agua"
  ],
  electricidad: [
    "electricista", "luz", "cableado",
    "instalacion electrica", "voltaje", "breaker",
    "panel electrico", "corriente", "enchufe", "interruptor"
  ],
  ninera: [
    "ninos", "nino", "bebe", "bebes",
    "babysitter", "cuidado de ninos", "cuidadora",
    "infancia", "guarderia", "maestra jardin"
  ],
  clases: [
    "tutor", "tutora", "profesor", "profesora",
    "maestra", "maestro", "ensenanza", "educacion",
    "matematicas", "ingles", "idiomas", "academia",
    "lectura", "escritura", "refuerzo", "ensena"
  ],
  pintura: [
    "pintor", "pintora", "pintar", "barniz",
    "paredes", "pintura de casas", "esmalte", "acabado"
  ],
  belleza: [
    "manicura", "pedicura", "estetica", "estilista",
    "cabello", "pelo", "unas", "maquillaje", "spa",
    "cosmetologa", "peluquera", "peluquero", "barbero",
    "barberia", "peluqueria", "nails"
  ],
  carpinteria: [
    "carpintero", "carpintera", "madera", "muebles",
    "puerta", "ventana", "ebanista", "armario", "closet"
  ],
  jardineria: [
    "jardinero", "jardinera", "plantas", "cesped",
    "grama", "podadora", "jardin", "poda", "huerto"
  ],
  mecanica: [
    "mecanico", "mecanica", "carro", "auto",
    "motor", "vehiculo", "taller", "automovil",
    "guagua", "moto", "motocicleta", "frenos", "aceite"
  ],
  costura: [
    "costurera", "costurero", "ropa", "modista",
    "sastre", "tela", "confeccion", "bordado", "uniformes"
  ],
  seguridad: [
    "guardia", "vigilante", "portero",
    "control de acceso", "vigilancia"
  ],
  mudanza: [
    "cargador", "camion", "transporte", "mover",
    "traslado", "flete", "acarreo"
  ],
  lavanderia: [
    "lavado", "lavanderia", "ropa limpia",
    "lavandera", "lavado de ropa", "plancha", "planchado"
  ],
  cuidado: [
    "enfermera", "enfermero", "cuidador", "cuidadora",
    "adulto mayor", "anciano", "acompanante", "salud",
    "paciente", "gerontologia"
  ],
  chofer: [
    "conductor", "taxi", "transporte", "manejar",
    "moto taxi", "vehiculo", "guia"
  ],
  ventas: [
    "vendedor", "vendedora", "comercial",
    "tienda", "mercadeo", "promotor", "promotora"
  ],
  agricultura: [
    "campo", "cosecha", "siembra", "agricultor",
    "agricultora", "finca", "ganado", "vaca", "granja"
  ],
  it: [
    "computadora", "computacion", "redes", "soporte tecnico",
    "programacion", "tecnico computadora", "internet",
    "sistema", "software", "hardware", "wifi"
  ]
};

/** Deduplicates a string array while preserving order (es5-safe). */
function dedupe(arr: string[]): string[] {
  const seen: Record<string, boolean> = {};
  return arr.filter(item => {
    if (seen[item]) return false;
    seen[item] = true;
    return true;
  });
}

/**
 * Expands a raw query into all matching tokens via the synonym map.
 * Returns the query itself plus all related synonyms.
 */
function expandQuery(raw: string): string[] {
  const q = normalizeText(raw);
  if (!q) return [];

  const wordTokens = q.split(/\s+/).filter(s => s.length > 0);

  // Direct key match (e.g. "plomeria" → plomería synonyms)
  if (Object.prototype.hasOwnProperty.call(SYNONYM_MAP, q)) {
    return dedupe([q].concat(SYNONYM_MAP[q] as string[]).concat(wordTokens));
  }

  // Check if q matches any synonym value (e.g. "plomero" → expand to "plomeria" key)
  const keys = Object.keys(SYNONYM_MAP);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const synonyms = SYNONYM_MAP[key];
    const hit = synonyms.some(function(s) {
      return s === q || q.includes(s) || s.includes(q);
    });
    if (hit) {
      return dedupe([key, q].concat(SYNONYM_MAP[key] as string[]).concat(wordTokens));
    }
  }

  // No synonym match — return the query and its individual word tokens
  return dedupe([q].concat(wordTokens));
}

/** Returns true if the normalized haystack contains at least one token. */
function containsAny(haystack: string, tokens: string[]): boolean {
  const h = normalizeText(haystack);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.length > 1 && h.includes(token)) return true;
  }
  return false;
}

/**
 * Returns true if the worker's searchable fields match the skill/service query.
 * Searches: skills array, short_intro.
 */
export function workerMatchesSkill(
  worker: { skills?: string[] | null; short_intro?: string | null },
  query: string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const tokens = expandQuery(trimmed);
  if (tokens.length === 0) return true;

  // Check skills array
  const skills = Array.isArray(worker.skills) ? worker.skills : [];
  for (let i = 0; i < skills.length; i++) {
    if (containsAny(skills[i], tokens)) return true;
  }

  // Check short_intro
  if (worker.short_intro && containsAny(worker.short_intro, tokens)) return true;

  return false;
}

/**
 * Returns true if the worker's city contains the city query (normalized).
 */
export function workerMatchesCity(
  worker: { city?: string | null },
  query: string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (!worker.city) return false;
  return normalizeText(worker.city).includes(normalizeText(trimmed));
}
