import { NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { classifyRows, buildMapping } from "@/lib/merge";
import { ensureAudio } from "@/lib/audio";
import { deleteAudioIfOrphaned } from "@/lib/cards";

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
  const decisions = body.decisions && typeof body.decisions === "object"
    ? (body.decisions as Record<string, string>)
    : {};
  const generateAudio = Boolean(body.generateAudio);

  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: "No rows to apply." }, { status: 400 });
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

  let created = 0;
  let updated = 0;
  const audioTargets: { id: string; front: string }[] = [];

  for (const row of classification.results) {
    if (row.kind === "new") {
      const note = await prisma.note.create({
        data: { deckId: deck.id, fields: JSON.stringify(row.fields) },
      });
      const card = await prisma.card.create({
        data: {
          deckId: deck.id,
          noteId: note.id,
          front: row.front,
          back: row.back,
          category: (row.category as Category) ?? "UNCATEGORISED",
        },
      });
      created++;
      if (generateAudio) audioTargets.push({ id: card.id, front: row.front });
      continue;
    }

    if (row.kind === "changed" && row.cardId) {
      const decision = decisions[row.cardId] ?? "keep";
      if (decision !== "override") continue;

      await prisma.note.update({
        where: { id: row.noteId! },
        data: { fields: JSON.stringify(row.fields) },
      });

      const data: { front: string; back: string; category?: Category } = {
        front: row.front,
        back: row.back,
      };
      if (row.category) data.category = row.category as Category;

      await prisma.card.update({ where: { id: row.cardId }, data });

      if (row.front !== row.current?.front) {
        audioTargets.push({ id: row.cardId, front: row.front });
      }

      updated++;
    }
  }

  // Regenerate audio for new/overridden words.
  for (const target of audioTargets) {
    try {
      const audio = await ensureAudio(deck.id, target.front, deck.language);
      if (audio) {
        const before = await prisma.card.findUnique({
          where: { id: target.id },
          select: { audioId: true },
        });
        await prisma.card.update({
          where: { id: target.id },
          data: { audioId: audio.id },
        });
        if (before?.audioId && before.audioId !== audio.id) {
          await deleteAudioIfOrphaned(before.audioId);
        }
      }
    } catch (error) {
      console.error("Audio generation error:", error);
    }
  }

  return NextResponse.json({ created, updated });
}
