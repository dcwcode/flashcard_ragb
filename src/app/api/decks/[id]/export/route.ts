import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseColumns, parseFields } from "@/lib/fields";
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

  const parsedColumns = parseColumns(deck.columns);
  const isLegacy = parsedColumns.length === 0;
  const columns = isLegacy ? ["front", "back"] : parsedColumns;

  const cards = await prisma.card.findMany({
    where: { deckId: deck.id },
    orderBy: { createdAt: "asc" },
    include: { note: true },
  });

  const header = ["id", ...columns, "category"];
  const rows = cards.map((card) => {
    const fields = parseFields(card.note.fields);
    const values = columns.map((col) =>
      isLegacy ? (col === "front" ? card.front : card.back) : (fields[col] ?? "")
    );
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
