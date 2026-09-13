import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateDefinitionAndSentence } from "@/lib/deepseek";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const deck = await prisma.deck.findFirst({
    where: { id: params.id, userId: auth.user.id },
    select: { language: true },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const words = Array.isArray(body.words)
    ? body.words
        .map((w: unknown) => String(w ?? "").trim())
        .filter(Boolean)
    : [];

  if (words.length === 0) {
    return NextResponse.json({ error: "No words provided." }, { status: 400 });
  }

  const results: { word: string; definition: string; sentence: string }[] = [];
  const errors: { word: string; error: string }[] = [];

  for (const word of words) {
    try {
      const { definition, sentence } = await generateDefinitionAndSentence(
        word,
        deck.language
      );
      results.push({ word, definition, sentence });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      errors.push({ word, error: message });
    }
  }

  return NextResponse.json({ results, errors });
}
