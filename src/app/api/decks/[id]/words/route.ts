import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseColumns } from "@/lib/fields";

const WORD_COLUMNS = ["Word", "Definition", "Sentence"];
const WORD_MAPPING = { front: ["Word"], back: ["Definition", "Sentence"] };

interface Entry {
  word: string;
  definition: string;
  sentence: string;
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

  const body = await request.json().catch(() => ({}));
  const rawEntries: unknown[] = Array.isArray(body.entries) ? body.entries : [];
  const entries: Entry[] = rawEntries
    .map((e) => {
      const obj = (e ?? {}) as Record<string, unknown>;
      return {
        word: String(obj.word ?? "").trim(),
        definition: String(obj.definition ?? "").trim(),
        sentence: String(obj.sentence ?? "").trim(),
      };
    })
    .filter((e) => e.word.length > 0);

  if (entries.length === 0) {
    return NextResponse.json({ error: "No words provided." }, { status: 400 });
  }

  // De-duplicate the submitted list (case-insensitive) and drop blank entries.
  const seen = new Set<string>();
  const unique: Entry[] = [];
  for (const e of entries) {
    const key = e.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }

  // Check against existing cards (case-insensitive on front).
  const existing = await prisma.card.findMany({
    where: { deckId: deck.id },
    select: { front: true },
  });
  const existingKeys = new Set(existing.map((c) => c.front.trim().toLowerCase()));

  const newEntries = unique.filter((e) => !existingKeys.has(e.word.toLowerCase()));
  const duplicates = unique
    .filter((e) => existingKeys.has(e.word.toLowerCase()))
    .map((e) => e.word);

  // Initialize the deck's field schema if it doesn't have one yet.
  if (parseColumns(deck.columns).length === 0) {
    await prisma.deck.update({
      where: { id: deck.id },
      data: {
        columns: JSON.stringify(WORD_COLUMNS),
        mapping: JSON.stringify(WORD_MAPPING),
      },
    });
  }

  let created = 0;
  for (const e of newEntries) {
    const fields = {
      Word: e.word,
      Definition: e.definition,
      Sentence: e.sentence,
    };
    const back = [e.definition, e.sentence].filter(Boolean).join("\n");

    const note = await prisma.note.create({
      data: { deckId: deck.id, fields: JSON.stringify(fields) },
    });
    await prisma.card.create({
      data: {
        deckId: deck.id,
        noteId: note.id,
        front: e.word,
        back: back || e.word,
      },
    });
    created++;
  }

  return NextResponse.json({ created, duplicates });
}
