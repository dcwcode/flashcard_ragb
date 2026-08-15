"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/lib/languages";

export function DeckActions({
  deckId,
  initialName,
  initialLanguage,
}: {
  deckId: string;
  initialName: string;
  initialLanguage: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState(initialLanguage);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/decks/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, language }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save.");
      setLoading(false);
      return;
    }

    setEditing(false);
    setLoading(false);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this deck and all its cards? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/decks");
      router.refresh();
    }
  }

  if (editing) {
    return (
      <form onSubmit={onSave} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(initialName);
              setLanguage(initialLanguage);
              setEditing(false);
            }}
            className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
      >
        Edit
      </button>
      <button
        onClick={onDelete}
        className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );
}
