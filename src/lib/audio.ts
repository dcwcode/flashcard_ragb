import { prisma } from "@/lib/prisma";
import { synthesize } from "@/lib/tts";

// Returns (or generates and stores) the audio for a given text+language,
// deduplicated per deck so identical text reuses the same MP3.
export async function ensureAudio(deckId: string, text: string, language: string) {
  const key = text.trim();
  if (!key) return null;

  const existing = await prisma.audioFile.findUnique({
    where: { deckId_text_language: { deckId, text: key, language } },
  });
  if (existing) return existing;

  const data = await synthesize(key, language);

  return prisma.audioFile.create({
    data: { deckId, text: key, language, data },
  });
}
