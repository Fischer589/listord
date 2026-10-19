/**
 * ListoRD — Category metadata.
 * Drives /categorias/[slug] landing pages and homepage pill links.
 * Each entry maps a URL slug to a SYNONYM_MAP key + SEO + display copy.
 */

export interface CategoryConfig {
  /** URL slug: /categorias/limpiadora */
  slug: string;
  /** Display label for pills */
  label: string;
  /** Emoji prefix */
  emoji: string;
  /** Key into lib/search.ts SYNONYM_MAP */
  searchKey: string;
  /** Page <title> */
  seoTitle: string;
  /** Meta description */
  seoDesc: string;
  /** <h1> on the category page */
  heroTitle: string;
  /** Subtitle below h1 */
  heroDesc: string;
  /** Meta keywords */
  keywords: string[];
  /** Singular worker label, lowercase */
  singular: string;
  /** Plural worker label, lowercase */
  plural: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    slug: "limpiadora",
    label: "Limpieza",
    emoji: "🧹",
    searchKey: "limpieza",
    seoTitle: "Limpiadoras en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de limpiadoras en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de limpiadoras en República Dominicana",
    heroDesc:
      "Revisa perfiles de limpiadoras gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "limpiadora",
      "empleada doméstica",
      "limpieza del hogar",
      "mucama",
      "servicio doméstico",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "limpiadora",
    plural: "limpiadoras",
  },
  {
    slug: "cocinera",
    label: "Cocina",
    emoji: "🍳",
    searchKey: "cocina",
    seoTitle: "Cocineras en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de cocineras en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de cocineras en República Dominicana",
    heroDesc:
      "Revisa perfiles de cocineras gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "cocinera",
      "cocinero",
      "chef",
      "cocina doméstica",
      "cocinar",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "cocinera",
    plural: "cocineras",
  },
  {
    slug: "plomero",
    label: "Plomería",
    emoji: "🔧",
    searchKey: "plomeria",
    seoTitle: "Plomeros en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de plomeros en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de plomeros en República Dominicana",
    heroDesc:
      "Revisa perfiles de plomeros gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "plomero",
      "plomería",
      "fontanero",
      "tubería",
      "fuga de agua",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "plomero",
    plural: "plomeros",
  },
  {
    slug: "electricista",
    label: "Electricidad",
    emoji: "💡",
    searchKey: "electricidad",
    seoTitle: "Electricistas en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de electricistas en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de electricistas en República Dominicana",
    heroDesc:
      "Revisa perfiles de electricistas gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "electricista",
      "electricidad",
      "instalación eléctrica",
      "breaker",
      "panel eléctrico",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "electricista",
    plural: "electricistas",
  },
  {
    slug: "albanil",
    label: "Construcción",
    emoji: "🏗️",
    searchKey: "construccion",
    seoTitle: "Albañiles en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de albañiles en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de albañiles en República Dominicana",
    heroDesc:
      "Revisa perfiles de albañiles gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "albañil",
      "construcción",
      "albanilería",
      "remodelación",
      "obra",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "albañil",
    plural: "albañiles",
  },
  {
    slug: "pintor",
    label: "Pintura",
    emoji: "🎨",
    searchKey: "pintura",
    seoTitle: "Pintores en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de pintores en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de pintores en República Dominicana",
    heroDesc:
      "Revisa perfiles de pintores gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "pintor",
      "pintura",
      "pintar casa",
      "pintura interior",
      "pintura exterior",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "pintor",
    plural: "pintores",
  },
  {
    slug: "tutor",
    label: "Clases",
    emoji: "📚",
    searchKey: "clases",
    seoTitle: "Tutores y profesores en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de tutores en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de tutores en República Dominicana",
    heroDesc:
      "Revisa perfiles de tutores gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "tutor",
      "profesor",
      "clases particulares",
      "refuerzo escolar",
      "matemáticas",
      "inglés",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "tutor",
    plural: "tutores",
  },
  {
    slug: "belleza",
    label: "Belleza",
    emoji: "💅",
    searchKey: "belleza",
    seoTitle: "Estilistas y manicuristas en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de especialistas en belleza en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de especialistas en belleza en República Dominicana",
    heroDesc:
      "Revisa perfiles de especialistas en belleza gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "manicurista",
      "estilista",
      "belleza",
      "uñas",
      "manicura",
      "pedicura",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "especialista en belleza",
    plural: "especialistas en belleza",
  },
  {
    slug: "jardinero",
    label: "Jardinería",
    emoji: "🌿",
    searchKey: "jardineria",
    seoTitle: "Jardineros en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de jardineros en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de jardineros en República Dominicana",
    heroDesc:
      "Revisa perfiles de jardineros gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "jardinero",
      "jardinería",
      "poda",
      "mantenimiento jardín",
      "paisajismo",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "jardinero",
    plural: "jardineros",
  },
  {
    slug: "chofer",
    label: "Conductor",
    emoji: "🚗",
    searchKey: "conductor",
    seoTitle: "Choferes y conductores en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de choferes en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de choferes en República Dominicana",
    heroDesc:
      "Revisa perfiles de choferes gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "chofer",
      "conductor",
      "transporte",
      "manejo",
      "delivery",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "chofer",
    plural: "choferes",
  },
  {
    slug: "ninera",
    label: "Cuidado niños",
    emoji: "👶",
    searchKey: "ninos",
    seoTitle: "Niñeras en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de niñeras en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de niñeras en República Dominicana",
    heroDesc:
      "Revisa perfiles de niñeras gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "niñera",
      "cuidado niños",
      "babysitter",
      "cuidadora infantil",
      "apoyo escolar",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "niñera",
    plural: "niñeras",
  },
  {
    slug: "cuidadora",
    label: "Cuidado adultos",
    emoji: "🏥",
    searchKey: "cuidadora",
    seoTitle: "Cuidadoras y enfermeras en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de cuidadoras en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de cuidadoras en República Dominicana",
    heroDesc:
      "Revisa perfiles de cuidadoras gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "cuidadora",
      "enfermera",
      "cuidado adultos",
      "adulto mayor",
      "asistencia médica",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "cuidadora",
    plural: "cuidadoras",
  },
  {
    slug: "carpintero",
    label: "Carpintería",
    emoji: "🔨",
    searchKey: "carpinteria",
    seoTitle: "Carpinteros en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de carpinteros en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de carpinteros en República Dominicana",
    heroDesc:
      "Revisa perfiles de carpinteros gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "carpintero",
      "carpintería",
      "muebles",
      "madera",
      "ebanista",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "carpintero",
    plural: "carpinteros",
  },
  {
    slug: "vigilante",
    label: "Seguridad",
    emoji: "🔒",
    searchKey: "seguridad",
    seoTitle: "Vigilantes y guardias en República Dominicana | ListoRD",
    seoDesc:
      "Explora perfiles de vigilantes en República Dominicana gratis. Conecta por WhatsApp desde RD$100 y confirma la disponibilidad directamente.",
    heroTitle: "Perfiles de vigilantes en República Dominicana",
    heroDesc:
      "Revisa perfiles de vigilantes gratis en tu ciudad. Elige con quién conectar por WhatsApp desde RD$100 y confirma los detalles directamente.",
    keywords: [
      "vigilante",
      "guarda",
      "seguridad",
      "guardia de seguridad",
      "Santo Domingo",
      "República Dominicana",
      "ListoRD",
    ],
    singular: "vigilante",
    plural: "vigilantes",
  },
];

/** Returns a category by its URL slug, or null if not found. */
export function getCategoryBySlug(slug: string): CategoryConfig | null {
  for (let i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
  }
  return null;
}
