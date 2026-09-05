// One-off backfill: populate note.fields for cards imported before the
// named-field storage feature (commit 660ce78). Those cards store only
// card.front/card.back and an empty note.fields ("{}"), so the CSV export
// renders them blank once the deck has named columns.
//
// Run:
//   locally:  node --env-file=.env scripts/backfill-fields.mjs
//   Railway:  node scripts/backfill-fields.mjs   (env vars already set)
//
// Idempotent: only touches cards whose note.fields is empty.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseColumns(json) {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function parseMapping(json) {
  try {
    const value = JSON.parse(json);
    return {
      front: Array.isArray(value?.front) ? value.front.map((v) => String(v)) : [],
      back: Array.isArray(value?.back) ? value.back.map((v) => String(v)) : [],
    };
  } catch {
    return { front: [], back: [] };
  }
}

function parseFields(json) {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

async function main() {
  const decks = await prisma.deck.findMany({
    select: { id: true, name: true, columns: true, mapping: true },
  });

  let totalFixed = 0;

  for (const deck of decks) {
    const columns = parseColumns(deck.columns);
    // Legacy deck (no named columns) already exports correctly via front/back.
    if (columns.length === 0) continue;

    const mapping = parseMapping(deck.mapping);
    const frontCols = mapping.front.length > 0 ? mapping.front : columns.slice(0, 1);
    const backCols = mapping.back.length > 0 ? mapping.back : columns.slice(1);
    const firstFrontCol = frontCols[0];
    const firstBackCol = backCols[0];

    const cards = await prisma.card.findMany({
      where: { deckId: deck.id },
      select: { id: true, front: true, back: true, noteId: true, note: { select: { fields: true } } },
    });

    let deckFixed = 0;
    for (const card of cards) {
      const fields = parseFields(card.note.fields);
      if (Object.keys(fields).length > 0) continue;

      const next = {};
      if (firstFrontCol) next[firstFrontCol] = card.front;
      if (firstBackCol) next[firstBackCol] = card.back;
      for (const col of columns) {
        if (!(col in next)) next[col] = "";
      }

      await prisma.note.update({
        where: { id: card.noteId },
        data: { fields: JSON.stringify(next) },
      });
      deckFixed++;
    }

    if (deckFixed > 0) {
      console.log(`deck "${deck.name}" (${deck.id}): backfilled ${deckFixed} card(s)`);
    }
    totalFixed += deckFixed;
  }

  console.log(`Done. Backfilled ${totalFixed} card(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
