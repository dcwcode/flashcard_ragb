"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import Link from "next/link";

type ColumnMapping = "ignore" | "front" | "back";

function buildPreview(
  row: string[],
  headers: string[],
  mapping: ColumnMapping[]
): { front: string; back: string } {
  const frontParts: string[] = [];
  const backParts: string[] = [];
  headers.forEach((_, i) => {
    const value = (row[i] ?? "").trim();
    if (!value) return;
    if (mapping[i] === "front") frontParts.push(value);
    if (mapping[i] === "back") backParts.push(value);
  });
  return { front: frontParts.join(" "), back: backParts.join(" ") };
}

export default function ImportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () =>
      headers.length > 0 &&
      mapping.includes("front") &&
      mapping.includes("back"),
    [headers, mapping]
  );

  const previewRows = useMemo(
    () =>
      rows
        .slice(0, 5)
        .map((row) => buildPreview(row, headers, mapping)),
    [rows, headers, mapping]
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
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

  async function onSubmit() {
    setError("");
    setLoading(true);

    const frontIndices = mapping
      .map((m, i) => (m === "front" ? i : -1))
      .filter((i) => i !== -1);
    const backIndices = mapping
      .map((m, i) => (m === "back" ? i : -1))
      .filter((i) => i !== -1);

    const res = await fetch(`/api/decks/${params.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows,
        mapping: { front: frontIndices, back: backIndices },
        generateAudio,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Import failed.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(`/decks/${params.id}?imported=${data.created}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/decks/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to deck
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Import cards</h1>
      </div>

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
            <p className="text-sm text-gray-500 mb-3">
              For each column, choose whether it appears on the front or back of the card.
            </p>
            <div className="space-y-2">
              {headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm font-medium">{header}</span>
                  <div className="flex gap-1 rounded-md border border-gray-300 p-1">
                    {(["front", "back", "ignore"] as ColumnMapping[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setColumnMapping(i, opt)}
                        className={`rounded px-3 py-1 text-sm capitalize ${
                          mapping[i] === opt
                            ? "bg-blue-600 text-white"
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
          </div>

          <div>
            <h2 className="text-lg font-medium mb-2">Preview</h2>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-200">
              {previewRows.map((p, i) => (
                <div key={i} className="grid grid-cols-2 gap-4 px-4 py-2">
                  <div>
                    <span className="text-xs text-gray-400">Front</span>
                    <p className="font-medium truncate">{p.front || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Back</span>
                    <p className="text-sm text-gray-600 truncate">{p.back || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={generateAudio}
              onChange={(e) => setGenerateAudio(e.target.checked)}
            />
            Generate audio for the front of each card (may take a moment)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={onSubmit}
            disabled={!canSubmit || loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Importing..."
              : `Import ${rows.length} card${rows.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
