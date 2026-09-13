"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface GeneratedEntry {
  word: string;
  definition: string;
  sentence: string;
}

export function AddWords({
  deckId,
  existingFronts,
}: {
  deckId: string;
  existingFronts: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [generated, setGenerated] = useState<GeneratedEntry[]>([]);
  const [generateErrors, setGenerateErrors] = useState<
    { word: string; error: string }[]
  >([]);
  const [busy, setBusy] = useState<"" | "generate" | "add">("");
  const [error, setError] = useState("");

  const existingSet = useMemo(
    () => new Set(existingFronts.map((f) => f.trim().toLowerCase())),
    [existingFronts]
  );

  const words = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of text.split(/[;\n]/)) {
      const value = part.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }, [text]);

  const newWords = words.filter((w) => !existingSet.has(w.toLowerCase()));
  const duplicateWords = words.filter((w) => existingSet.has(w.toLowerCase()));

  function updateGenerated(
    word: string,
    key: "definition" | "sentence",
    value: string
  ) {
    setGenerated((prev) =>
      prev.map((g) => (g.word === word ? { ...g, [key]: value } : g))
    );
  }

  function removeGenerated(word: string) {
    setGenerated((prev) => prev.filter((g) => g.word !== word));
  }

  async function onGenerate() {
    setError("");
    setGenerateErrors([]);
    setBusy("generate");

    const res = await fetch(`/api/decks/${deckId}/words/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: newWords }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Generation failed.");
      setBusy("");
      return;
    }

    setGenerated(Array.isArray(data.results) ? data.results : []);
    setGenerateErrors(Array.isArray(data.errors) ? data.errors : []);
    setBusy("");
  }

  async function onAdd() {
    setError("");
    setBusy("add");

    const entries = generated.map((g) => ({
      word: g.word.trim(),
      definition: g.definition.trim(),
      sentence: g.sentence.trim(),
    }));

    const res = await fetch(`/api/decks/${deckId}/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to add words.");
      setBusy("");
      return;
    }

    setText("");
    setGenerated([]);
    setGenerateErrors([]);
    setBusy("");
    router.refresh();
  }

  const canGenerate = newWords.length > 0 && busy !== "generate";
  const canAdd = generated.length > 0 && busy !== "add";

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-medium">Add words</h2>
        <p className="text-sm text-gray-500">
          Type one word per line or separate with <code>;</code>. Duplicates are
          skipped automatically.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"apple\nbanana; cherry"}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words.map((word) => {
            const isDuplicate = existingSet.has(word.toLowerCase());
            return (
              <span
                key={word}
                className={`rounded-full px-3 py-1 text-sm ${
                  isDuplicate
                    ? "bg-gray-100 text-gray-400 line-through"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {word}
              </span>
            );
          })}
        </div>
      )}

      {duplicateWords.length > 0 && (
        <p className="text-sm text-gray-500">
          {duplicateWords.length} word{duplicateWords.length === 1 ? "" : "s"}{" "}
          already in this deck and will be skipped.
        </p>
      )}

      {generated.length === 0 ? (
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === "generate"
            ? "Generating…"
            : `Generate definitions & sentences (${newWords.length})`}
        </button>
      ) : (
        <div className="space-y-3">
          {generated.map((entry) => (
            <div
              key={entry.word}
              className="rounded-md border border-gray-200 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{entry.word}</p>
                <button
                  onClick={() => removeGenerated(entry.word)}
                  className="text-sm text-gray-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Definition
                <textarea
                  value={entry.definition}
                  onChange={(e) =>
                    updateGenerated(entry.word, "definition", e.target.value)
                  }
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Sentence
                <textarea
                  value={entry.sentence}
                  onChange={(e) =>
                    updateGenerated(entry.word, "sentence", e.target.value)
                  }
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
            </div>
          ))}

          {generateErrors.length > 0 && (
            <div className="text-sm text-amber-700 space-y-1">
              {generateErrors.map((e) => (
                <p key={e.word}>
                  <span className="font-medium">{e.word}</span>: {e.error}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onAdd}
              disabled={!canAdd}
              className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy === "add" ? "Adding…" : `Add ${generated.length} card${generated.length === 1 ? "" : "s"}`}
            </button>
            <button
              onClick={() => setGenerated([])}
              disabled={busy === "add"}
              className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
