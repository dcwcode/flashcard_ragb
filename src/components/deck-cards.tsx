"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";

export interface DeckCard {
  id: string;
  front: string;
  back: string;
  category: string;
  hasAudio: boolean;
}

export function DeckCards({
  deckId,
  cards,
}: {
  deckId: string;
  cards: DeckCard[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = cards.length > 0 && selected.size === cards.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(cards.map((c) => c.id)));
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this card?")) return;
    setBusy(true);
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} card${selected.size === 1 ? "" : "s"}?`)) {
      return;
    }
    setBusy(true);
    await fetch(`/api/decks/${deckId}/cards`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300"
          />
          Select all
        </label>
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={busy}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? "Deleting..." : `Delete selected (${selected.size})`}
          </button>
        )}
      </div>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {cards.map((card) => (
          <li
            key={card.id}
            className="px-4 py-3 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <input
                type="checkbox"
                checked={selected.has(card.id)}
                onChange={() => toggle(card.id)}
                className="h-4 w-4 rounded border-gray-300 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-medium truncate text-gray-900">{card.front}</p>
                <p className="text-sm text-gray-500 truncate">{card.back}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {card.hasAudio && (
                <span className="text-xs text-gray-400">🔊</span>
              )}
              <CategoryBadge category={card.category} />
              <button
                onClick={() => deleteOne(card.id)}
                disabled={busy}
                title="Delete card"
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
