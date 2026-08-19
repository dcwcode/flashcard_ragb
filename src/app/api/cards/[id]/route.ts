import { NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteCardWithCleanup, deleteAudioIfOrphaned } from "@/lib/cards";
import { ensureAudio } from "@/lib/audio";
import {
  deriveFrontBack,
  effectiveColumns,
  effectiveMapping,
  FieldMap,
} from "@/lib/fields";

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
    include: {
      deck: {
        select: { id: true, language: true, columns: true, mapping: true },
      },
      note: { select: { id: true } },
    },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { category?: Category; front?: string; back?: string } = {};
  let updateNoteFields: string | null = null;

  if (body.category !== undefined) {
    const category = String(body.category).toUpperCase();
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    data.category = category as Category;
  }

  if (body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)) {
    const fields: FieldMap = {};
    for (const [key, value] of Object.entries(body.fields)) {
      fields[key] = String(value ?? "");
    }
    const columns = effectiveColumns(card.deck.columns);
    const mapping = effectiveMapping(card.deck.mapping, columns);
    const { front, back } = deriveFrontBack(fields, mapping);
    if (!front || !back) {
      return NextResponse.json(
        { error: "Fields produce an empty front or back." },
        { status: 400 }
      );
    }
    data.front = front;
    data.back = back;
    updateNoteFields = JSON.stringify(fields);
  } else {
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
  }

  const updated = await prisma.card.update({
    where: { id: params.id },
    data,
  });

  if (updateNoteFields !== null) {
    await prisma.note.update({
      where: { id: card.note.id },
      data: { fields: updateNoteFields },
    });
  }

  // If the front text changed, regenerate audio for the new word.
  let finalAudioId: string | null = card.audioId;
  if (data.front && data.front !== card.front) {
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
