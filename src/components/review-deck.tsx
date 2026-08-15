"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryValue, CATEGORIES } from "@/lib/categories";

interface ReviewCard {
  id: string;
  front: string;
  back: string;
  category: string;
  audioId: string | null;
}

export function ReviewDeck({ cards }: { cards: ReviewCard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioMap, setAudioMap] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const card = cards[index];
  const audioId = card ? audioMap[card.id] ?? card.audioId : null;

  useEffect(() => {
    const el = audioRef.current;
    if (el && audioId) {
      el.play().catch(() => {});
    }
  }, [index, audioId]);

  async function generateAudio() {
    if (!card || generating) return;
    setGenerating(true);
    setAudioError("");

    const res = await fetch(`/api/cards/${card.id}/audio`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAudioError(data.error || "Audio generation failed.");
      setGenerating(false);
      return;
    }

    const data = await res.json();
    setAudioMap((prev) => ({ ...prev, [card.id]: data.audioId }));
    setGenerating(false);
  }

  async function assign(category: CategoryValue) {
    if (!card || saving) return;
    setSaving(true);

    await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });

    setSaving(false);

    if (index + 1 >= cards.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
      setAudioError("");
    }
  }

  if (finished) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-semibold">All done!</h2>
        <p className="text-gray-500">You reviewed {cards.length} cards.</p>
        <button
          onClick={() => {
            setIndex(0);
            setFlipped(false);
            setFinished(false);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start over
        </button>
      </div>
    );
  }

  if (!card) {
    return <p className="text-gray-500">No cards to review.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <span>{card.category !== "UNCATEGORISED" ? "Reviewing" : "New"}</span>
      </div>

      <div className="flex items-center justify-center min-h-12">
        {audioId ? (
          <audio
            key={audioId}
            ref={audioRef}
            controls
            autoPlay
            src={`/api/audio/${audioId}`}
            className="h-10"
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={generateAudio}
              disabled={generating}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {generating ? "Generating audio..." : "Generate audio"}
            </button>
            {audioError && (
              <p className="text-xs text-red-600">{audioError}</p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-64 rounded-xl border border-gray-200 bg-white p-8 text-center hover:border-gray-300 transition-colors"
      >
        {!flipped ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">
              Front
            </p>
            <p className="text-3xl font-semibold break-words">{card.front}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">
              Back
            </p>
            <p className="text-2xl text-gray-800 break-words">{card.back}</p>
          </div>
        )}
      </button>

      {!flipped ? (
        <button
          onClick={() => setFlipped(true)}
          className="w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Show answer
        </button>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-2 text-center">
            How did you do?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.filter((c) => c.value !== "UNCATEGORISED").map((c) => (
              <button
                key={c.value}
                onClick={() => assign(c.value)}
                disabled={saving}
                className={`rounded-md px-4 py-3 text-sm font-medium disabled:opacity-50 ${categoryColor(c.value)}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => assign("UNCATEGORISED")}
            disabled={saving}
            className="mt-2 w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Skip (keep uncategorised)
          </button>
        </div>
      )}
    </div>
  );
}

function categoryColor(category: CategoryValue): string {
  switch (category) {
    case "RED":
      return "bg-red-600 text-white hover:bg-red-700";
    case "AMBER":
      return "bg-amber-500 text-white hover:bg-amber-600";
    case "GREEN":
      return "bg-green-600 text-white hover:bg-green-700";
    case "BLUE":
      return "bg-blue-600 text-white hover:bg-blue-700";
    default:
      return "bg-gray-200 text-gray-700 hover:bg-gray-300";
  }
}
