// One-off repair: reset each deck's columns/mapping to the clean field names
// (mapping.front + mapping.back) and normalize every card's note.fields to
// those names. Fixes the inconsistency where older cards keep their field data
// keyed by stale/corrupted column names, which made export and edit render blank.
//
// Run:
//   dry-run:  node --env-file=.env scripts/repair-fields.mjs
//   apply:    node --env-file=.env scripts/repair-fields.mjs --apply
//   one deck: DECK_ID=... node --env-file=.env scripts/repair-fields.mjs --apply

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const DECK_ID = process.env.DECK_ID ?? null;

const RESERVED = new Set(["id", "card_id", "cardid", "category"]);

function parseColumns(json) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function parseMapping(json) {
  try {
    const v = JSON.parse(json);
    return {
      front: Array.isArray(v?.front) ? v.front.map((x) => String(x)) : [],
      back: Array.isArray(v?.back) ? v.back.map((x) => String(x)) : [],
    };
  } catch {
    return { front: [], back: [] };
  }
}

function parseFields(json) {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// Rebuild a card's fields using the correct column names.
function rebuild(fields, cols, front, back) {
  const [frontCol, back1, back2] = cols;

  // Already keyed by the correct front column name.
  if (fields[frontCol] != null && String(fields[frontCol]).trim() !== "") {
    return {
      [frontCol]: String(fields[frontCol] ?? front).trim(),
      [back1]: String(fields[back1] ?? "").trim(),
      [back2]: String(fields[back2] ?? "").trim(),
    };
  }

  // Stale/legacy keys: recover the definition/sentence positionally.
  const vals = Object.values(fields)
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  if (vals.length >= 2) {
    const firstIsWord =
      front && vals[0].toLowerCase() === front.trim().toLowerCase();
    const start = firstIsWord ? 1 : 0;
    return {
      [frontCol]: front,
      [back1]: vals[start] ?? "",
      [back2]: vals[start + 1] ?? "",
    };
  }

  // Empty fields: rebuild from the card's front/back.
  return { [frontCol]: front, [back1]: back, [back2]: "" };
}

async function main() {
  const decks = await prisma.deck.findMany({
    where: DECK_ID ? { id: DECK_ID } : {},
    select: { id: true, name: true, columns: true, mapping: true },
  });

  let totalCards = 0;
  let totalCorrect = 0;
  let totalRecovered = 0;
  let totalRebuilt = 0;
  let totalChanged = 0;

  for (const deck of decks) {
    const mapping = parseMapping(deck.mapping);
    const front = mapping.front.filter((c) => !RESERVED.has(c.trim().toLowerCase()));
    const back = mapping.back.filter((c) => !RESERVED.has(c.trim().toLowerCase()));
    const cols = [...front, ...back];

    if (cols.length < 2) {
      console.log(`SKIP deck "${deck.name}" (${deck.id}): no usable mapping`);
      continue;
    }

    const cards = await prisma.card.findMany({
      where: { deckId: deck.id },
      select: { id: true, front: true, back: true, noteId: true, note: { select: { fields: true } } },
    });

    let correct = 0, recovered = 0, rebuilt = 0, changed = 0;
    const samples = [];

    for (const card of cards) {
      const fields = parseFields(card.note.fields);
      const next = rebuild(fields, cols, card.front, card.back);
      const nextJson = JSON.stringify(next);

      const hasFront = fields[cols[0]] != null && String(fields[cols[0]]).trim() !== "";
      const vals = Object.values(fields).filter((v) => String(v ?? "").trim() !== "");

      if (nextJson === card.note.fields) {
        correct++;
      } else if (hasFront) {
        // already keyed correctly; only stray keys removed
        correct++;
      } else if (vals.length >= 2) {
        recovered++;
      } else {
        rebuilt++;
      }

      if (nextJson !== card.note.fields) {
        changed++;
        if (samples.length < 5) {
          samples.push({ id: card.id, front: card.front, before: card.note.fields, after: nextJson });
        }
      }

      if (APPLY && nextJson !== card.note.fields) {
        await prisma.note.update({ where: { id: card.noteId }, data: { fields: nextJson } });
      }
    }

    if (APPLY) {
      await prisma.deck.update({
        where: { id: deck.id },
        data: { columns: JSON.stringify(cols), mapping: JSON.stringify({ front, back }) },
      });
    }

    console.log(`deck "${deck.name}" (${deck.id}): ${cards.length} cards`);
    console.log(`  correct=${correct} recovered=${recovered} rebuilt=${rebuilt} to-change=${changed}`);
    for (const s of samples) {
      console.log(`  SAMPLE front="${s.front}"`);
      console.log(`    before=${s.before}`);
      console.log(`    after =${s.after}`);
    }

    totalCards += cards.length;
    totalCorrect += correct;
    totalRecovered += recovered;
    totalRebuilt += rebuilt;
    totalChanged += changed;
  }

  console.log("");
  console.log(`${APPLY ? "APPLIED" : "DRY-RUN"} — totals: ${totalCards} cards, correct=${totalCorrect}, recovered=${totalRecovered}, rebuilt=${totalRebuilt}, changed=${totalChanged}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
