/**
 * ListoRD — City metadata.
 * Drives /categorias/[slug]/[city] landing pages.
 * Each entry maps a URL slug to a city name used for worker location filtering.
 */

export interface CityConfig {
  /** URL slug: /categorias/limpiadora/santo-domingo */
  slug: string;
  /** Display name — also used as the filter value against workers.city */
  name: string;
  /** Province / region label */
  region: string;
}

export const CITIES: CityConfig[] = [
  { slug: "santo-domingo",            name: "Santo Domingo",            region: "Distrito Nacional" },
  { slug: "santiago",                 name: "Santiago",                 region: "Santiago"          },
  { slug: "san-pedro-de-macoris",     name: "San Pedro de Macorís",     region: "San Pedro de Macorís" },
  { slug: "la-romana",                name: "La Romana",                region: "La Romana"         },
  { slug: "puerto-plata",             name: "Puerto Plata",             region: "Puerto Plata"      },
  { slug: "higuey",                   name: "Higüey",                   region: "La Altagracia"     },
  { slug: "san-francisco-de-macoris", name: "San Francisco de Macorís", region: "Duarte"            },
  { slug: "boca-chica",               name: "Boca Chica",               region: "Santo Domingo"     },
];

/** Returns a city by its URL slug, or null if not found. */
export function getCityBySlug(slug: string): CityConfig | null {
  for (let i = 0; i < CITIES.length; i++) {
    if (CITIES[i].slug === slug) return CITIES[i];
  }
  return null;
}
