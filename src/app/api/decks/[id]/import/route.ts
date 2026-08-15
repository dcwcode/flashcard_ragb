import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureAudio } from "@/lib/audio";

interface ImportBody {
  rows: string[][];
  mapping: { front: number[]; back: number[] };
  generateAudio?: boolean;
}

function joinColumns(row: string[], indices: number[]): string {
  return indices
    .map((i) => (row[i] ?? "").trim())
    .filter((v) => v.length > 0)
    .join(" ");
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<{ value?: R; error?: unknown }[]> {
  const results: { value?: R; error?: unknown }[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = { value: await fn(items[i]) };
      } catch (error) {
        results[i] = { error };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const deck = await prisma.deck.findFirst({
    where: { id: params.id, userId: auth.user.id },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as ImportBody;

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }

  const front = Array.isArray(body.mapping?.front) ? body.mapping.front : [];
  const back = Array.isArray(body.mapping?.back) ? body.mapping.back : [];

  if (front.length === 0 || back.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column for both front and back." },
      { status: 400 }
    );
  }

  // Create notes + cards.
  const createdCards = await prisma.$transaction(async (tx) => {
    const created: { id: string; front: string }[] = [];

    for (const row of body.rows) {
      const frontText = joinColumns(row, front);
      const backText = joinColumns(row, back);

      if (!frontText || !backText) continue;

      const note = await tx.note.create({
        data: { deckId: deck.id, fields: "{}" },
      });

      const card = await tx.card.create({
        data: {
          deckId: deck.id,
          noteId: note.id,
          front: frontText,
          back: backText,
        },
      });

      created.push({ id: card.id, front: frontText });
    }

    return created;
  });

  // Optionally generate audio for each new card (deduplicated by text+language).
  let audioGenerated = 0;
  let audioFailed = 0;

  if (body.generateAudio && createdCards.length > 0) {
    const results = await mapLimit(createdCards, 4, async ({ id, front: text }) => {
      const audio = await ensureAudio(deck.id, text, deck.language);
      if (audio) {
        await prisma.card.update({ where: { id }, data: { audioId: audio.id } });
      }
    });

    for (const r of results) {
      if (r.error) audioFailed++;
      else audioGenerated++;
    }
  }

  return NextResponse.json(
    { created: createdCards.length, audioGenerated, audioFailed },
    { status: 201 }
  );
}
