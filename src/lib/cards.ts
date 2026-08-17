import { prisma } from "@/lib/prisma";

// Deletes an audio file if no cards reference it anymore.
export async function deleteAudioIfOrphaned(audioId: string) {
  const remaining = await prisma.card.count({ where: { audioId } });
  if (remaining === 0) {
    await prisma.audioFile.delete({ where: { id: audioId } });
  }
}

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
    await deleteAudioIfOrphaned(card.audioId);
  }
}
