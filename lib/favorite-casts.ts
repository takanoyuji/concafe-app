import type { Prisma } from "@prisma/client";

/** User.favoriteCastIds（Json）をキャストIDの配列として解釈 */
export function parseFavoriteCastIds(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  return [];
}
