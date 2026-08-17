import { NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteCardWithCleanup } from "@/lib/cards";

const VALID_CATEGORIES = [
  "UNCATEGORISED",
  "RED",
  "AMBER",
  "GREEN",
  "BLUE",
];

export async function PATCH(
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
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => String(id))
    : [];
  const category = String(body.category ?? "").toUpperCase();

  if (ids.length === 0) {
    return NextResponse.json({ error: "No cards selected." }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const result = await prisma.card.updateMany({
    where: { id: { in: ids }, deckId: deck.id },
    data: { category: category as Category },
  });

  return NextResponse.json({ updated: result.count });
}

export async function DELETE(
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
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => String(id))
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No cards selected." }, { status: 400 });
  }

  // Ensure every id belongs to this deck before deleting.
  const cards = await prisma.card.findMany({
    where: { id: { in: ids }, deckId: deck.id },
    select: { id: true },
  });
  const validIds = cards.map((c) => c.id);

  for (const id of validIds) {
    await deleteCardWithCleanup(id);
  }

  return NextResponse.json({ deleted: validIds.length });
}
