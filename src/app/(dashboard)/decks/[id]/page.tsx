import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { languageLabel } from "@/lib/languages";
import { DeckActions } from "@/components/deck-actions";
import { DeckCards } from "@/components/deck-cards";
import { effectiveColumns, parseFields } from "@/lib/fields";

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
        include: {
          audio: { select: { id: true } },
          note: { select: { fields: true } },
        },
      },
    },
  });

  if (!deck) notFound();

  const columns = effectiveColumns(deck.columns);

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

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/decks/${deck.id}/import`}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Import CSV
        </Link>
        {deck.cards.length > 0 && (
          <>
            <Link
              href={`/decks/${deck.id}/merge`}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Update cards
            </Link>
            <Link
              href={`/decks/${deck.id}/review`}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Review
            </Link>
            <a
              href={`/api/decks/${deck.id}/export`}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Export CSV
            </a>
          </>
        )}
      </div>

      {deck.cards.length === 0 ? (
        <p className="text-gray-500">
          No cards yet. Import a CSV to get started.
        </p>
      ) : (
        <DeckCards
          deckId={deck.id}
          columns={columns}
          cards={deck.cards.map((card) => ({
            id: card.id,
            front: card.front,
            back: card.back,
            category: card.category,
            hasAudio: Boolean(card.audio),
            fields: parseFields(card.note.fields),
          }))}
        />
      )}
    </div>
  );
}
