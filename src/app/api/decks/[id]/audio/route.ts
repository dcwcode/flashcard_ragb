import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureAudio } from "@/lib/audio";
import { mapLimit } from "@/lib/concurrency";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const deck = await prisma.deck.findFirst({
    where: { id: params.id, userId: auth.user.id },
    select: { id: true, language: true },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => String(id))
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No cards selected." }, { status: 400 });
  }

  const cards = await prisma.card.findMany({
    where: { id: { in: ids }, deckId: deck.id },
    select: { id: true, front: true, audioId: true },
  });

  // Skip cards that already have audio.
  const skipped = cards.filter((c) => c.audioId).length;
  const todo = cards.filter((c) => !c.audioId);

  let generated = 0;
  let failed = 0;

  if (todo.length > 0) {
    const results = await mapLimit(todo, 4, async (card) => {
      const audio = await ensureAudio(deck.id, card.front, deck.language);
      if (audio) {
        await prisma.card.update({
          where: { id: card.id },
          data: { audioId: audio.id },
        });
      }
    });

    for (const r of results) {
      if (r.error) failed++;
      else generated++;
    }
  }

  return NextResponse.json({ generated, skipped, failed });
}
