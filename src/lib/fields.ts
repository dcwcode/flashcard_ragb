export type FieldMap = Record<string, string>;

export interface DeckMapping {
  front: string[];
  back: string[];
}

export function parseFields(json: string): FieldMap {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as FieldMap)
      : {};
  } catch {
    return {};
  }
}

export function parseColumns(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export function parseMapping(json: string): DeckMapping {
  try {
    const value = JSON.parse(json);
    const front = Array.isArray(value?.front)
      ? value.front.map((v: unknown) => String(v))
      : [];
    const back = Array.isArray(value?.back)
      ? value.back.map((v: unknown) => String(v))
      : [];
    return { front, back };
  } catch {
    return { front: [], back: [] };
  }
}

// Effective ordered column names, falling back to front/back for legacy decks.
export function effectiveColumns(columnsJson: string): string[] {
  const columns = parseColumns(columnsJson);
  return columns.length > 0 ? columns : ["front", "back"];
}

// Effective mapping, falling back to first-column -> front, rest -> back.
export function effectiveMapping(
  mappingJson: string,
  columns: string[]
): DeckMapping {
  const mapping = parseMapping(mappingJson);
  if (mapping.front.length > 0 || mapping.back.length > 0) return mapping;
  return { front: columns.slice(0, 1), back: columns.slice(1) };
}

// Derive front/back text from a field map using a mapping.
export function deriveFrontBack(
  fields: FieldMap,
  mapping: DeckMapping
): { front: string; back: string } {
  const join = (names: string[]) =>
    names
      .map((n) => (fields[n] ?? "").trim())
      .filter((v) => v.length > 0)
      .join(" ");
  return { front: join(mapping.front), back: join(mapping.back) };
}
