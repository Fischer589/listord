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
      "Contrata limpiadoras y empleadas domésticas verificadas en Santo Domingo, Santiago y toda la RD. Sin agencias — contacto directo por WhatsApp.",
    heroTitle: "Limpiadoras verificadas en República Dominicana",
    heroDesc:
      "Encuentra limpiadoras de hogar confiables en tu ciudad. Perfiles verificados por nuestro equipo — escríbeles directo por WhatsApp.",
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
      "Contrata cocineras domésticas y chefs verificados en Santo Domingo, Santiago y toda la RD. Sin agencias — contacto directo por WhatsApp.",
    heroTitle: "Cocineras verificadas en República Dominicana",
    heroDesc:
      "Cocineras domésticas y chefs disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata plomeros verificados en Santo Domingo, Santiago y toda la RD. Fugas, instalaciones de agua, tuberías — contacto directo por WhatsApp.",
    heroTitle: "Plomeros verificados en República Dominicana",
    heroDesc:
      "Plomeros disponibles para fugas, tuberías e instalaciones de agua. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata electricistas verificados en Santo Domingo, Santiago y toda la RD. Instalaciones eléctricas, breakers, paneles — contacto directo por WhatsApp.",
    heroTitle: "Electricistas verificados en República Dominicana",
    heroDesc:
      "Electricistas disponibles para instalaciones, reparaciones y paneles eléctricos. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata albañiles verificados en Santo Domingo, Santiago y toda la RD. Obra, remodelación, reparaciones — contacto directo por WhatsApp.",
    heroTitle: "Albañiles verificados en República Dominicana",
    heroDesc:
      "Albañiles y ayudantes de construcción disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata pintores verificados en Santo Domingo, Santiago y toda la RD. Pintura de interiores y exteriores — contacto directo por WhatsApp.",
    heroTitle: "Pintores verificados en República Dominicana",
    heroDesc:
      "Pintores disponibles para interiores, exteriores y acabados. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata tutores y profesores verificados en Santo Domingo, Santiago y toda la RD. Matemáticas, inglés, refuerzo escolar — contacto directo por WhatsApp.",
    heroTitle: "Tutores verificados en República Dominicana",
    heroDesc:
      "Profesores y tutores disponibles para clases particulares y refuerzo escolar. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata estilistas, manicuristas y especialistas en belleza verificados en Santo Domingo, Santiago y toda la RD. Contacto directo por WhatsApp.",
    heroTitle: "Estilistas y especialistas en belleza verificados en RD",
    heroDesc:
      "Manicuristas, estilistas y técnicas en uñas disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata jardineros verificados en Santo Domingo, Santiago y toda la RD. Poda, mantenimiento de jardines, paisajismo — contacto directo por WhatsApp.",
    heroTitle: "Jardineros verificados en República Dominicana",
    heroDesc:
      "Jardineros y paisajistas disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata choferes verificados en Santo Domingo, Santiago y toda la RD. Transporte personal, mandados, rutas — contacto directo por WhatsApp.",
    heroTitle: "Choferes verificados en República Dominicana",
    heroDesc:
      "Conductores disponibles para transporte personal, mandados y rutas. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata niñeras verificadas en Santo Domingo, Santiago y toda la RD. Cuidado de niños en casa, apoyo escolar — contacto directo por WhatsApp.",
    heroTitle: "Niñeras verificadas en República Dominicana",
    heroDesc:
      "Niñeras y cuidadoras de niños disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata cuidadoras verificadas en Santo Domingo, Santiago y toda la RD. Cuidado de adultos mayores, asistencia médica en casa — contacto directo por WhatsApp.",
    heroTitle: "Cuidadoras verificadas en República Dominicana",
    heroDesc:
      "Cuidadoras y asistentes de salud disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata carpinteros verificados en Santo Domingo, Santiago y toda la RD. Muebles, reparaciones, instalaciones de madera — contacto directo por WhatsApp.",
    heroTitle: "Carpinteros verificados en República Dominicana",
    heroDesc:
      "Carpinteros disponibles para muebles, reparaciones e instalaciones. Perfiles verificados — escríbeles directo por WhatsApp.",
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
      "Contrata vigilantes verificados en Santo Domingo, Santiago y toda la RD. Seguridad residencial, comercial, eventos — contacto directo por WhatsApp.",
    heroTitle: "Vigilantes verificados en República Dominicana",
    heroDesc:
      "Vigilantes y guardias de seguridad disponibles en tu ciudad. Perfiles verificados — escríbeles directo por WhatsApp.",
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
