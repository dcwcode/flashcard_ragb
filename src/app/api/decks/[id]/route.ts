import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

async function getOwnedDeck(userId: string, deckId: string) {
  return prisma.deck.findFirst({
    where: { id: deckId, userId },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const deck = await prisma.deck.findFirst({
    where: { id: params.id, userId: auth.user.id },
    include: {
      _count: { select: { cards: true } },
    },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  return NextResponse.json({ deck });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const deck = await getOwnedDeck(auth.user.id, params.id);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; language?: string } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.language === "string" && body.language.trim()) {
    data.language = body.language.trim();
  }

  const updated = await prisma.deck.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ deck: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const deck = await getOwnedDeck(auth.user.id, params.id);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  await prisma.deck.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
