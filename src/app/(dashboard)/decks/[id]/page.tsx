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
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    merged?: string;
    created?: string;
    audioGenerated?: string;
    audioFailed?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const createdCount = Number(searchParams.created ?? 0);
  const updatedCount = Number(searchParams.merged ?? 0);
  const audioGenerated = Number(searchParams.audioGenerated ?? 0);
  const audioFailed = Number(searchParams.audioFailed ?? 0);

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
          href={`/decks/${deck.id}/merge`}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Import CSV
        </Link>
        {deck.cards.length > 0 && (
          <>
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

      {(createdCount > 0 || updatedCount > 0) && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <p className="text-gray-700">
            {createdCount > 0 && (
              <>
                Imported {createdCount} new card{createdCount === 1 ? "" : "s"}
              </>
            )}
            {createdCount > 0 && updatedCount > 0 && " · "}
            {updatedCount > 0 && (
              <>
                Updated {updatedCount} card{updatedCount === 1 ? "" : "s"}
              </>
            )}
            .
          </p>
          {audioFailed > 0 ? (
            <p className="text-amber-700 mt-1">
              Audio generation failed for {audioFailed} card
              {audioFailed === 1 ? "" : "s"}. Select them and use “Generate
              audio” to retry.
            </p>
          ) : (
            audioGenerated > 0 && (
              <p className="text-gray-600 mt-1">
                Audio generated for {audioGenerated} card
                {audioGenerated === 1 ? "" : "s"}.
              </p>
            )
          )}
        </div>
      )}

      {deck.cards.length === 0 ? (
        <p className="text-gray-500">
          No cards yet.{" "}
          <Link
            href={`/decks/${deck.id}/merge`}
            className="text-blue-600 hover:underline"
          >
            Import a CSV
          </Link>{" "}
          to get started.
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
