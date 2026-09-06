import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseColumns, parseFields, parseMapping } from "@/lib/fields";
import { categoryLabel } from "@/lib/categories";
import { toCsv } from "@/lib/csv";

export async function GET(
  _request: Request,
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

  const RESERVED = new Set(["id", "card_id", "cardid", "category"]);
  const parsedColumns = parseColumns(deck.columns).filter(
    (c) => !RESERVED.has(c.trim().toLowerCase())
  );
  const isLegacy = parsedColumns.length === 0;
  const columns = isLegacy ? ["front", "back"] : parsedColumns;
  const mapping = parseMapping(deck.mapping);
  const frontCols =
    mapping.front.length > 0 ? mapping.front : columns.slice(0, 1);
  const backCols = mapping.back.length > 0 ? mapping.back : columns.slice(1);
  const firstFrontCol = frontCols[0];
  const firstBackCol = backCols[0];

  const cards = await prisma.card.findMany({
    where: { deckId: deck.id },
    orderBy: { createdAt: "asc" },
    include: { note: true },
  });

  const header = ["id", ...columns, "category"];
  const rows = cards.map((card) => {
    const fields = parseFields(card.note.fields);
    const values = columns.map((col) => {
      if (isLegacy) return col === "front" ? card.front : card.back;
      const value = (fields[col] ?? "").trim();
      if (value) return fields[col];
      // Fall back to the card's front/back when the stored field is missing
      // or keyed by a stale column name.
      if (col === firstFrontCol) return card.front;
      if (col === firstBackCol) return card.back;
      return "";
    });
    return [card.id, ...values, categoryLabel(card.category)];
  });

  const csv = toCsv([header, ...rows]);

  const filename = `${deck.name.replace(/[^\w\- ]+/g, "").trim() || "deck"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
