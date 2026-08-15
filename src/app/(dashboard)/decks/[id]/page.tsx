import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { languageLabel } from "@/lib/languages";
import { DeckActions } from "@/components/deck-actions";
import { CategoryBadge } from "@/components/category-badge";

export default async function DeckDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const deck = await prisma.deck.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      cards: {
        orderBy: { createdAt: "asc" },
        include: { audio: { select: { id: true } } },
      },
    },
  });

  if (!deck) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{deck.name}</h1>
          <p className="text-sm text-gray-500">
            {languageLabel(deck.language)} · {deck.cards.length} cards
          </p>
        </div>
        <DeckActions
          deckId={deck.id}
          initialName={deck.name}
          initialLanguage={deck.language}
        />
      </div>

      <div className="flex gap-2">
        <Link
          href={`/decks/${deck.id}/import`}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Import CSV
        </Link>
        {deck.cards.length > 0 && (
          <Link
            href={`/decks/${deck.id}/review`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Review
          </Link>
        )}
      </div>

      {deck.cards.length === 0 ? (
        <p className="text-gray-500">
          No cards yet. Import a CSV to get started.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {deck.cards.map((card) => (
            <li key={card.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{card.front}</p>
                <p className="text-sm text-gray-500 truncate">{card.back}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {card.audio && (
                  <span className="text-xs text-gray-400">🔊</span>
                )}
                <CategoryBadge category={card.category} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
