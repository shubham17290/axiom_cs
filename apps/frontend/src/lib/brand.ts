// PREPForge — brand constants (single source of truth for product name, nav labels, tone).
// PG-STD-01: prototype branding layer built on top of the existing UI tokens.

export const BRAND = {
  name: "PREPForge",
  tagline: "Forge your GATE CS & IT prep with real previous-year questions.",
  shortName: "PF",
  // A "forge" accent (teal) paired with the existing academic indigo primary.
  accent: "#0d9488", // teal-600
  accentSoft: "#ccfbf1", // teal-100
  accentInk: "#134e4a", // teal-900
} as const;

/** Canonical student navigation. Keep in sync with the navbar. */
export const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subjects", label: "Subjects" },
  { href: "/practice", label: "Practice" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/mistakes", label: "Mistakes" },
] as const;

export const ADMIN_NAV = { href: "/admin", label: "Admin" };