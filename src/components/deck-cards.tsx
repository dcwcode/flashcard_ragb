"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { CATEGORIES, CategoryValue } from "@/lib/categories";

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
  const [bulkCategory, setBulkCategory] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

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

  async function moveSelected(category: CategoryValue) {
    if (selected.size === 0) return;
    setBusy(true);
    await fetch(`/api/decks/${deckId}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), category }),
    });
    setBusy(false);
    setSelected(new Set());
    setBulkCategory("");
    router.refresh();
  }

  function reviewSelected() {
    if (selected.size === 0) return;
    router.push(`/decks/${deckId}/review?ids=${Array.from(selected).join(",")}`);
  }

  function startEdit(card: DeckCard) {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: editFront, back: editBack }),
    });
    setBusy(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkCategory}
              onChange={(e) => {
                const value = e.target.value as CategoryValue;
                setBulkCategory(value);
                if (value) moveSelected(value);
              }}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Move to…</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <button
              onClick={reviewSelected}
              disabled={busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Review selected ({selected.size})
            </button>

            <button
              onClick={deleteSelected}
              disabled={busy}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {cards.map((card) => (
          <li key={card.id} className="px-4 py-3">
            {editingId === card.id ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Front
                  <textarea
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Back
                  <textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(card.id)}
                    disabled={busy}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
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
                    onClick={() => startEdit(card)}
                    disabled={busy}
                    title="Edit card"
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
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
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                      />
                    </svg>
                  </button>
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
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
