import { NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteCardWithCleanup, deleteAudioIfOrphaned } from "@/lib/cards";
import { ensureAudio } from "@/lib/audio";

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
    include: { deck: { select: { id: true, language: true } } },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { category?: Category; front?: string; back?: string } = {};

  if (body.category !== undefined) {
    const category = String(body.category).toUpperCase();
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    data.category = category as Category;
  }

  if (body.front !== undefined) {
    const front = String(body.front).trim();
    if (!front) {
      return NextResponse.json(
        { error: "Front cannot be empty." },
        { status: 400 }
      );
    }
    if (front !== card.front) data.front = front;
  }

  if (body.back !== undefined) {
    const back = String(body.back).trim();
    if (!back) {
      return NextResponse.json(
        { error: "Back cannot be empty." },
        { status: 400 }
      );
    }
    if (back !== card.back) data.back = back;
  }

  const updated = await prisma.card.update({
    where: { id: params.id },
    data,
  });

  // If the front text changed, regenerate audio for the new word.
  let finalAudioId: string | null = card.audioId;
  if (data.front) {
    try {
      const audio = await ensureAudio(
        card.deck.id,
        data.front,
        card.deck.language
      );
      if (audio) {
        await prisma.card.update({
          where: { id: params.id },
          data: { audioId: audio.id },
        });
        finalAudioId = audio.id;
        if (card.audioId && card.audioId !== audio.id) {
          await deleteAudioIfOrphaned(card.audioId);
        }
      }
    } catch (error) {
      console.error("Audio regeneration error:", error);
    }
  }

  return NextResponse.json({ card: { ...updated, audioId: finalAudioId } });
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
