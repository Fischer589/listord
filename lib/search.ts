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
    "domestico", "domicilio", "mucama", "servicio domestico",
  ],
  cocina: [
    "cocinera", "cocinero", "cocinar", "chef",
    "comida", "gastronomia", "reposteria", "repostero",
    "panaderia", "pasteleria", "cafeteria", "restaurante",
  ],
  construccion: [
    "albanil", "albanila", "ayudante", "obra",
    "cemento", "constructor", "albanileria", "pared",
    "bloque", "mezcla", "edificacion", "remodelacion",
    "arreglo", "reparacion casa",
  ],
  plomeria: [
    "plomero", "plomera", "tuberia", "bano",
    "fuga", "fontanero", "instalacion agua", "griferia",
    "tubos", "cano", "sanitario", "agua",
  ],
  electricidad: [
    "electricista", "luz", "cableado",
    "instalacion electrica", "voltaje", "breaker",
    "panel electrico", "corriente", "enchufe", "interruptor",
  ],
  ninera: [
    "ninos", "nino", "bebe", "bebes",
    "babysitter", "cuidado de ninos", "cuidadora",
    "infancia", "guarderia", "maestra jardin",
  ],
  clases: [
    "tutor", "tutora", "profesor", "profesora",
    "maestra", "maestro", "ensenanza", "educacion",
    "matematicas", "ingles", "idiomas", "academia",
    "lectura", "escritura", "refuerzo", "ensena",
  ],
  pintura: [
    "pintor", "pintora", "pintar", "barniz",
    "paredes", "pintura de casas", "esmalte", "acabado",
  ],
  belleza: [
    "manicura", "pedicura", "estetica", "estilista",
    "cabello", "pelo", "unas", "maquillaje", "spa",
    "cosmetologa", "peluquera", "peluquero", "barbero",
    "barberia", "peluqueria", "nails",
  ],
  carpinteria: [
    "carpintero", "carpintera", "madera", "muebles",
    "puerta", "ventana", "ebanista", "armario", "closet",
  ],
  jardineria: [
    "jardinero", "jardinera", "plantas", "cesped",
    "grama", "podadora", "jardin", "poda", "huerto",
  ],
  mecanica: [
    "mecanico", "mecanica", "carro", "auto",
    "motor", "vehiculo", "taller", "automovil",
    "guagua", "moto", "motocicleta", "frenos", "aceite",
  ],
  costura: [
    "costurera", "costurero", "ropa", "modista",
    "sastre", "tela", "confeccion", "bordado", "uniformes",
  ],
  seguridad: [
    "guardia", "vigilante", "portero",
    "control de acceso", "vigilancia",
  ],
  mudanza: [
    "cargador", "camion", "transporte", "mover",
    "traslado", "flete", "acarreo",
  ],
  lavanderia: [
    "lavado", "lavanderia", "ropa limpia",
    "lavandera", "lavado de ropa", "plancha", "planchado",
  ],
  cuidado: [
    "enfermera", "enfermero", "cuidador", "cuidadora",
    "adulto mayor", "anciano", "acompanante", "salud",
    "paciente", "gerontologia",
  ],
  chofer: [
    "conductor", "taxi", "transporte", "manejar",
    "manejo", "vehiculo", "carro", "auto",
    "delivery", "mensajero", "motorista",
  ],
};

/** Adds a value to an array only if it is not already present (ES5-safe dedup). */
function addUnique(arr: string[], value: string): void {
  if (arr.indexOf(value) === -1) arr.push(value);
}

/**
 * Returns true if the worker's skills or intro match the given search term.
 * Checks exact/substring match first, then synonym expansion.
 */
export function workerMatchesSkill(
  worker: {
    skills?: string[] | null;
    short_intro?: string | null;
  },
  searchTerm: string
): boolean {
  if (!searchTerm.trim()) return true;

  const normalized = normalizeText(searchTerm);

  // Build a flat normalized string from all skill tokens + intro
  const skillsText = (worker.skills ?? [])
    .map((s) => normalizeText(s))
    .join(" ");
  const introText = normalizeText(worker.short_intro ?? "");
  const allText = (skillsText + " " + introText).trim();

  // Direct substring match
  if (allText.includes(normalized)) return true;

  // Synonym expansion — collect all related terms (ES5-safe, no Set iteration)
  const expandedTerms: string[] = [normalized];

  // If the search term is a canonical key, add all its synonyms
  const directSynonyms = SYNONYM_MAP[normalized];
  if (directSynonyms) {
    for (let i = 0; i < directSynonyms.length; i++) {
      addUnique(expandedTerms, directSynonyms[i]);
    }
  }

  // If the search term is itself a synonym, find its canonical key and siblings
  const canonicalKeys = Object.keys(SYNONYM_MAP);
  for (let k = 0; k < canonicalKeys.length; k++) {
    const canonicalKey = canonicalKeys[k];
    const synonyms = SYNONYM_MAP[canonicalKey];
    if (synonyms.indexOf(normalized) !== -1) {
      addUnique(expandedTerms, canonicalKey);
      for (let s = 0; s < synonyms.length; s++) {
        addUnique(expandedTerms, synonyms[s]);
      }
      break;
    }
  }

  // Match any expanded term against the combined worker text
  for (let t = 0; t < expandedTerms.length; t++) {
    if (allText.includes(expandedTerms[t])) return true;
  }

  return false;
}

/**
 * Returns true if the worker's city matches the search city (normalized partial match).
 */
export function workerMatchesCity(
  worker: { city?: string | null },
  searchCity: string
): boolean {
  if (!searchCity.trim()) return true;
  if (!worker.city) return false;
  return normalizeText(worker.city).includes(normalizeText(searchCity));
}
