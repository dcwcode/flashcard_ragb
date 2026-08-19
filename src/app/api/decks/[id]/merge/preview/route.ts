import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { classifyRows, buildMapping } from "@/lib/merge";

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
  const headers = Array.isArray(body.headers)
    ? body.headers.map((h: unknown) => String(h).trim()).filter(Boolean)
    : [];
  const rows = Array.isArray(body.rows) ? body.rows : [];

  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: "No rows to review." }, { status: 400 });
  }

  const frontIdx = Array.isArray(body.mapping?.front) ? body.mapping.front : [];
  const backIdx = Array.isArray(body.mapping?.back) ? body.mapping.back : [];
  const mapping = buildMapping(headers, frontIdx, backIdx);

  if (mapping.front.length === 0 || mapping.back.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column for both front and back." },
      { status: 400 }
    );
  }

  const classification = await classifyRows(deck.id, headers, rows, mapping);

  const newRows = classification.results
    .filter((r) => r.kind === "new")
    .map((r) => ({ front: r.front, back: r.back, category: r.category }));

  const changedRows = classification.results
    .filter((r) => r.kind === "changed")
    .map((r) => ({
      cardId: r.cardId,
      key: r.front,
      current: r.current,
      incoming: { front: r.front, back: r.back, category: r.category },
    }));

  const unchangedCount = classification.results.filter(
    (r) => r.kind === "unchanged"
  ).length;

  return NextResponse.json({
    columns: classification.columns,
    idColumn: classification.idColumn,
    summary: {
      new: newRows.length,
      changed: changedRows.length,
      unchanged: unchangedCount,
    },
    newRows,
    changedRows,
  });
}
