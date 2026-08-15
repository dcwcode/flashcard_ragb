import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const decks = await prisma.deck.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cards: true } } },
  });

  return NextResponse.json({ decks });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const language = String(body.language ?? "en-US").trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: { userId: auth.user.id, name, language },
  });

  return NextResponse.json({ deck }, { status: 201 });
}
