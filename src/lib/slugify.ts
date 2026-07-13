/**
 * Generates a URL-safe slug from a string.
 * Appends a short random suffix to prevent collisions.
 *
 * @example slugify("2026 Science Fair") => "2026-science-fair-a3f7"
 */
export function slugify(text: string): string {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w-]+/g, "") // Remove non-word chars (except hyphens)
    .replace(/--+/g, "-") // Collapse consecutive hyphens
    .replace(/^-+/, "") // Trim leading hyphens
    .replace(/-+$/, ""); // Trim trailing hyphens

  // Append a 4-char random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);

  return `${base}-${suffix}`;
}
