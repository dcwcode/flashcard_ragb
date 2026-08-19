"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";

type ColumnMapping = "ignore" | "front" | "back";

interface ChangedRow {
  cardId: string;
  key: string;
  current: { front: string; back: string; category: string };
  incoming: { front: string; back: string; category: string | null };
}

interface Preview {
  summary: { new: number; changed: number; unchanged: number };
  changedRows: ChangedRow[];
}

const ID_HEADERS = new Set(["id", "card_id", "cardid"]);

export default function MergePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [fileName, setFileName] = useState("");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "keep" | "override">>(
    {}
  );

  const idColumnIndex = useMemo(
    () => headers.findIndex((h) => ID_HEADERS.has(h.trim().toLowerCase())),
    [headers]
  );
  const categoryColumnIndex = useMemo(
    () => headers.findIndex((h) => h.trim().toLowerCase() === "category"),
    [headers]
  );

  const canPreview = useMemo(
    () => headers.length > 0 && mapping.includes("front") && mapping.includes("back"),
    [headers, mapping]
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPreview(null);
    setFileName(file.name);

    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete(results) {
        if (results.data.length === 0) {
          setError("The file appears to be empty.");
          return;
        }
        const firstRow = results.data[0];
        const dataRows = results.data.slice(1);
        setHeaders(firstRow);
        setRows(dataRows);
        setMapping(firstRow.map(() => "ignore" as ColumnMapping));
      },
      error() {
        setError("Could not parse the CSV file.");
      },
    });
  }

  function setColumnMapping(index: number, value: ColumnMapping) {
    setMapping((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function onPreview() {
    setError("");
    setLoading(true);

    const frontIndices = mapping
      .map((m, i) => (m === "front" ? i : -1))
      .filter((i) => i !== -1);
    const backIndices = mapping
      .map((m, i) => (m === "back" ? i : -1))
      .filter((i) => i !== -1);

    const res = await fetch(`/api/decks/${params.id}/merge/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headers,
        rows,
        mapping: { front: frontIndices, back: backIndices },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Preview failed.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setPreview(data);
    const initial: Record<string, "keep" | "override"> = {};
    data.changedRows.forEach((r: ChangedRow) => (initial[r.cardId] = "keep"));
    setDecisions(initial);
    setLoading(false);
  }

  function setDecision(cardId: string, value: "keep" | "override") {
    setDecisions((prev) => ({ ...prev, [cardId]: value }));
  }

  function setAll(value: "keep" | "override") {
    const next: Record<string, "keep" | "override"> = {};
    preview?.changedRows.forEach((r) => (next[r.cardId] = value));
    setDecisions(next);
  }

  async function onApply() {
    if (!preview) return;
    setError("");
    setLoading(true);

    const frontIndices = mapping
      .map((m, i) => (m === "front" ? i : -1))
      .filter((i) => i !== -1);
    const backIndices = mapping
      .map((m, i) => (m === "back" ? i : -1))
      .filter((i) => i !== -1);

    const res = await fetch(`/api/decks/${params.id}/merge/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headers,
        rows,
        mapping: { front: frontIndices, back: backIndices },
        decisions,
        generateAudio,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Apply failed.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(`/decks/${params.id}?merged=${data.updated}&created=${data.created}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/decks/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to deck
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Update cards</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV to add new cards and update existing ones. Rows matching an
          existing card (by id, then by the front/word) are flagged for review.
        </p>
      </div>

      {!preview && (
        <>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
            />
            {fileName && <p className="text-sm text-gray-500 mt-2">Loaded: {fileName}</p>}
          </div>

          {headers.length > 0 && (
            <>
              <div>
                <h2 className="text-lg font-medium mb-2">Map columns</h2>
                <div className="space-y-2">
                  {headers.map((header, i) => {
                    const isId = i === idColumnIndex;
                    const isCategory = i === categoryColumnIndex;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-40 truncate text-sm font-medium">
                          {header}
                          {isId && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                              identifier
                            </span>
                          )}
                          {isCategory && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                              category
                            </span>
                          )}
                        </span>
                        <div className="flex gap-1 rounded-md border border-gray-300 p-1">
                          {(["front", "back", "ignore"] as ColumnMapping[]).map(
                            (opt) => (
                              <button
                                key={opt}
                                type="button"
                                disabled={isId || isCategory}
                                onClick={() => setColumnMapping(i, opt)}
                                className={`rounded px-3 py-1 text-sm capitalize disabled:opacity-40 ${
                                  mapping[i] === opt
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                {opt}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={(e) => setGenerateAudio(e.target.checked)}
                />
                Generate audio for new and updated words (may take a moment)
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={onPreview}
                disabled={!canPreview || loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Checking…" : "Preview duplicates"}
              </button>
            </>
          )}
        </>
      )}

      {preview && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 p-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium text-green-700">{preview.summary.new}</span> new
              card{preview.summary.new === 1 ? "" : "s"} will be added
            </p>
            <p className="text-sm">
              <span className="font-medium text-amber-700">{preview.summary.changed}</span>{" "}
              existing card{preview.summary.changed === 1 ? "" : "s"} have changes to review
            </p>
            <p className="text-sm text-gray-500">
              {preview.summary.unchanged} unchanged card
              {preview.summary.unchanged === 1 ? "" : "s"} (skipped)
            </p>
          </div>

          {preview.changedRows.length > 0 && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setAll("override")}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Override all
                </button>
                <button
                  onClick={() => setAll("keep")}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Keep all
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 divide-y divide-gray-200">
                {preview.changedRows.map((row) => (
                  <div key={row.cardId} className="px-4 py-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs uppercase text-gray-400">Current</p>
                        <p className="font-medium text-gray-900 whitespace-pre-line">
                          {row.current.front}
                        </p>
                        <p className="text-sm text-gray-600 whitespace-pre-line">
                          {row.current.back}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400">Incoming</p>
                        <p className="font-medium text-gray-900 whitespace-pre-line">
                          {row.incoming.front}
                        </p>
                        <p className="text-sm text-gray-600 whitespace-pre-line">
                          {row.incoming.back}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1 rounded-md border border-gray-300 p-1 w-fit">
                      {(["keep", "override"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setDecision(row.cardId, opt)}
                          className={`rounded px-3 py-1 text-sm capitalize ${
                            decisions[row.cardId] === opt
                              ? opt === "override"
                                ? "bg-green-600 text-white"
                                : "bg-gray-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={onApply}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Applying…" : "Apply changes"}
            </button>
            <button
              onClick={() => setPreview(null)}
              disabled={loading}
              className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
