import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureAudio } from "@/lib/audio";
import { deriveFrontBack, FieldMap } from "@/lib/fields";

interface ImportBody {
  headers?: string[];
  rows?: string[][];
  mapping?: { front?: number[]; back?: number[] };
  generateAudio?: boolean;
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

  const headers = Array.isArray(body.headers)
    ? body.headers.map((h) => String(h).trim()).filter(Boolean)
    : [];

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }

  const frontIdx = Array.isArray(body.mapping?.front) ? body.mapping.front : [];
  const backIdx = Array.isArray(body.mapping?.back) ? body.mapping.back : [];

  const frontNames = frontIdx
    .map((i) => headers[i])
    .filter((h): h is string => Boolean(h));
  const backNames = backIdx
    .map((i) => headers[i])
    .filter((h): h is string => Boolean(h));

  if (frontNames.length === 0 || backNames.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column for both front and back." },
      { status: 400 }
    );
  }

  const mapping = { front: frontNames, back: backNames };

  // Record the deck's field schema and mapping.
  await prisma.deck.update({
    where: { id: deck.id },
    data: {
      columns: JSON.stringify(headers),
      mapping: JSON.stringify(mapping),
    },
  });

  // Create notes + cards.
  const createdCards = await prisma.$transaction(async (tx) => {
    const created: { id: string; front: string }[] = [];

    for (const row of body.rows!) {
      const fields: FieldMap = {};
      headers.forEach((header, i) => {
        fields[header] = row[i] ?? "";
      });

      const { front, back } = deriveFrontBack(fields, mapping);
      if (!front || !back) continue;

      const note = await tx.note.create({
        data: { deckId: deck.id, fields: JSON.stringify(fields) },
      });

      const card = await tx.card.create({
        data: { deckId: deck.id, noteId: note.id, front, back },
      });

      created.push({ id: card.id, front });
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
