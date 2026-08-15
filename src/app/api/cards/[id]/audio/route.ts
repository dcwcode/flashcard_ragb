import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureAudio } from "@/lib/audio";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const card = await prisma.card.findFirst({
    where: { id: params.id, deck: { userId: auth.user.id } },
    include: { deck: { select: { id: true, language: true } } },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  try {
    const audio = await ensureAudio(card.deck.id, card.front, card.deck.language);
    if (!audio) {
      return NextResponse.json({ error: "Nothing to generate." }, { status: 400 });
    }

    await prisma.card.update({
      where: { id: card.id },
      data: { audioId: audio.id },
    });

    return NextResponse.json({ audioId: audio.id });
  } catch (error) {
    console.error("Audio generation error:", error);
    return NextResponse.json(
      { error: "Audio generation failed. Please try again." },
      { status: 500 }
    );
  }
}
