import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { languageLabel } from "@/lib/languages";
import Link from "next/link";
import { NewDeckForm } from "@/components/new-deck-form";

export default async function DecksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cards: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your decks</h1>
      </div>

      <NewDeckForm />

      {decks.length === 0 ? (
        <p className="text-gray-500">No decks yet. Create your first deck above.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium">{deck.name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {languageLabel(deck.language)}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {deck._count.cards} cards
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
