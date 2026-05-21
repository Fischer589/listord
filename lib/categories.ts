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
];

/** Returns a category by its URL slug, or null if not found. */
export function getCategoryBySlug(slug: string): CategoryConfig | null {
  for (let i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
  }
  return null;
}
