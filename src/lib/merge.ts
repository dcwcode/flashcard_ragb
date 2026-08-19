import { prisma } from "@/lib/prisma";
import { deriveFrontBack, FieldMap } from "@/lib/fields";
import { normalizeCategory, CategoryValue } from "@/lib/categories";

export interface MergeMapping {
  front: string[];
  back: string[];
}

export interface ClassifiedRow {
  kind: "new" | "changed" | "unchanged";
  fields: FieldMap;
  front: string;
  back: string;
  category: CategoryValue | null;
  cardId?: string;
  noteId?: string;
  current?: {
    front: string;
    back: string;
    category: string;
    audioId: string | null;
  };
}

export interface Classification {
  columns: string[];
  idColumn: string | null;
  results: ClassifiedRow[];
}

const ID_HEADERS = new Set(["id", "card_id", "cardid"]);

export function detectIdColumn(headers: string[]): number | null {
  const idx = headers.findIndex((h) => ID_HEADERS.has(h.trim().toLowerCase()));
  return idx === -1 ? null : idx;
}

export function detectCategoryColumn(headers: string[]): number | null {
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === "category");
  return idx === -1 ? null : idx;
}

export function buildMapping(
  headers: string[],
  frontIdx: number[],
  backIdx: number[]
): MergeMapping {
  return {
    front: frontIdx.map((i) => headers[i]).filter((h): h is string => Boolean(h)),
    back: backIdx.map((i) => headers[i]).filter((h): h is string => Boolean(h)),
  };
}

export async function classifyRows(
  deckId: string,
  headers: string[],
  rows: string[][],
  mapping: MergeMapping
): Promise<Classification> {
  const idColumnIndex = detectIdColumn(headers);
  const categoryColumnIndex = detectCategoryColumn(headers);

  const existingCards = await prisma.card.findMany({
    where: { deckId },
    include: { note: true },
  });

  const byId = new Map(existingCards.map((c) => [c.id, c]));
  const byFront = new Map(
    existingCards.map((c) => [c.front.trim().toLowerCase(), c])
  );

  const results: ClassifiedRow[] = [];

  for (const row of rows) {
    const fields: FieldMap = {};
    headers.forEach((h, i) => {
      fields[h] = row[i] ?? "";
    });

    const { front, back } = deriveFrontBack(fields, mapping);
    if (!front) continue;

    let category: CategoryValue | null = null;
    if (categoryColumnIndex !== null) {
      category = normalizeCategory(row[categoryColumnIndex] ?? "");
    }

    const idValue =
      idColumnIndex !== null ? (row[idColumnIndex] ?? "").trim() : "";

    const matchedById = idValue ? byId.get(idValue) : undefined;
    const matched = matchedById ?? byFront.get(front.trim().toLowerCase());

    if (!matched) {
      results.push({ kind: "new", fields, front, back, category });
      continue;
    }

    const changed =
      front !== matched.front ||
      back !== matched.back ||
      (category !== null && category !== matched.category);

    results.push({
      kind: changed ? "changed" : "unchanged",
      fields,
      front,
      back,
      category,
      cardId: matched.id,
      noteId: matched.noteId,
      current: {
        front: matched.front,
        back: matched.back,
        category: matched.category,
        audioId: matched.audioId,
      },
    });
  }

  return {
    columns: headers,
    idColumn: idColumnIndex !== null ? headers[idColumnIndex] : null,
    results,
  };
}
