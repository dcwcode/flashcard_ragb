import { prisma } from "@/lib/prisma";

// Deletes a card and cleans up any now-orphaned note and audio file.
export async function deleteCardWithCleanup(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { noteId: true, audioId: true },
  });
  if (!card) return;

  await prisma.card.delete({ where: { id: cardId } });

  if (card.noteId) {
    const remainingNotes = await prisma.card.count({
      where: { noteId: card.noteId },
    });
    if (remainingNotes === 0) {
      await prisma.note.delete({ where: { id: card.noteId } });
    }
  }

  if (card.audioId) {
    const remainingAudio = await prisma.card.count({
      where: { audioId: card.audioId },
    });
    if (remainingAudio === 0) {
      await prisma.audioFile.delete({ where: { id: card.audioId } });
    }
  }
}
