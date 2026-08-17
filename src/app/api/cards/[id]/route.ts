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

  const card = await prisma.card.findFirst({
    where: { id: params.id, deck: { userId: auth.user.id } },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const category = String(body.category ?? "").toUpperCase();

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: "Invalid category." },
      { status: 400 }
    );
  }

  const updated = await prisma.card.update({
    where: { id: params.id },
    data: { category: category as Category },
  });

  return NextResponse.json({ card: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const card = await prisma.card.findFirst({
    where: { id: params.id, deck: { userId: auth.user.id } },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  await deleteCardWithCleanup(params.id);

  return NextResponse.json({ ok: true });
}
