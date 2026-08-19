export type CategoryValue =
  | "UNCATEGORISED"
  | "RED"
  | "AMBER"
  | "GREEN"
  | "BLUE";

export const CATEGORIES: { value: CategoryValue; label: string }[] = [
  { value: "UNCATEGORISED", label: "Uncategorised" },
  { value: "RED", label: "Red" },
  { value: "AMBER", label: "Amber" },
  { value: "GREEN", label: "Green" },
  { value: "BLUE", label: "Blue" },
];

const BADGE_STYLES: Record<CategoryValue, string> = {
  UNCATEGORISED: "bg-gray-100 text-gray-700",
  RED: "bg-red-100 text-red-700",
  AMBER: "bg-amber-100 text-amber-700",
  GREEN: "bg-green-100 text-green-700",
  BLUE: "bg-blue-100 text-blue-700",
};

export function categoryBadgeClass(value: CategoryValue): string {
  return BADGE_STYLES[value] ?? BADGE_STYLES.UNCATEGORISED;
}

const PILL_STYLES: Record<CategoryValue, { active: string; inactive: string }> = {
  UNCATEGORISED: {
    active: "bg-gray-500 text-white",
    inactive: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  },
  RED: {
    active: "bg-red-600 text-white",
    inactive: "bg-red-100 text-red-700 hover:bg-red-200",
  },
  AMBER: {
    active: "bg-amber-500 text-white",
    inactive: "bg-amber-100 text-amber-700 hover:bg-amber-200",
  },
  GREEN: {
    active: "bg-green-600 text-white",
    inactive: "bg-green-100 text-green-700 hover:bg-green-200",
  },
  BLUE: {
    active: "bg-blue-600 text-white",
    inactive: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  },
};

export function categoryPillClass(value: CategoryValue, active: boolean): string {
  const styles = PILL_STYLES[value] ?? PILL_STYLES.UNCATEGORISED;
  return active ? styles.active : styles.inactive;
}

export function categoryLabel(value: string): string {
  const found = CATEGORIES.find((c) => c.value === value);
  return found?.label ?? value;
}

// Parse a category from either an enum value ("RED") or a label ("Red"),
// case-insensitive. Returns null when unrecognised.
export function normalizeCategory(input: string): CategoryValue | null {
  const value = String(input ?? "").trim().toUpperCase();
  const byValue = CATEGORIES.find((c) => c.value === value);
  if (byValue) return byValue.value;
  const byLabel = CATEGORIES.find((c) => c.label.toUpperCase() === value);
  return byLabel ? byLabel.value : null;
}
