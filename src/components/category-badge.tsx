import { CategoryValue, categoryBadgeClass, categoryLabel } from "@/lib/categories";

export function CategoryBadge({ category }: { category: string }) {
  const value = category as CategoryValue;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(value)}`}
    >
      {categoryLabel(category)}
    </span>
  );
}
