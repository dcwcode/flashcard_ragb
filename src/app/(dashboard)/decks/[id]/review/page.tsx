import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Category } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, CategoryValue, categoryPillClass } from "@/lib/categories";
import { ReviewDeck } from "@/components/review-deck";

const VALID_FILTERS = new Set<string>(CATEGORIES.map((c) => c.value));

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { category?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const deck = await prisma.deck.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!deck) notFound();

  const filter = searchParams.category ?? "ALL";
  const where =
    filter === "ALL" || !VALID_FILTERS.has(filter)
      ? { deckId: deck.id }
      : { deckId: deck.id, category: filter as Category };

  const cards = await prisma.card.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      front: true,
      back: true,
      category: true,
      audioId: true,
    },
  });

  const counts = await prisma.card.groupBy({
    by: ["category"],
    where: { deckId: deck.id },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(
    counts.map((c) => [c.category, c._count._all])
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/decks/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to deck
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Review · {deck.name}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink
          deckId={deck.id}
          value="ALL"
          label={`All (${cardsTotal(countMap)})`}
          active={filter === "ALL"}
        />
        {CATEGORIES.map((c) => (
          <FilterLink
            key={c.value}
            deckId={deck.id}
            value={c.value}
            label={`${c.label} (${countMap[c.value] ?? 0})`}
            active={filter === c.value}
          />
        ))}
      </div>

      <ReviewDeck cards={cards} />
    </div>
  );
}

function cardsTotal(countMap: Record<string, number>): number {
  return Object.values(countMap).reduce((a, b) => a + b, 0);
}

function FilterLink({
  deckId,
  value,
  label,
  active,
}: {
  deckId: string;
  value: string;
  label: string;
  active: boolean;
}) {
  const href =
    value === "ALL" ? `/decks/${deckId}/review` : `/decks/${deckId}/review?category=${value}`;

  const className =
    value === "ALL"
      ? active
        ? "bg-blue-600 text-white"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      : categoryPillClass(value as CategoryValue, active);

  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${className}`}
    >
      {label}
    </Link>
  );
}
