import { languageLabel } from "@/lib/languages";

const BASE_URL = "https://api.deepseek.com";
const MODEL = "deepseek-flash";

export interface DefinitionResult {
  definition: string;
  sentence: string;
}

function parseJsonContent(content: string): DefinitionResult | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const definition = String(parsed?.definition ?? "").trim();
    const sentence = String(parsed?.sentence ?? "").trim();
    if (!definition && !sentence) return null;
    return { definition, sentence };
  } catch {
    return null;
  }
}

export async function generateDefinitionAndSentence(
  word: string,
  language: string
): Promise<DefinitionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const langLabel = languageLabel(language);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a dictionary assistant. Respond only with a single JSON object in the exact shape {\"definition\": string, \"sentence\": string}.",
        },
        {
          role: "user",
          content: `For the word "${word}" in ${langLabel}, provide a concise dictionary definition and one natural example sentence. Return JSON only.`,
        },
      ],
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek API error (${res.status}): ${body}`);
  }

  const data = await res.json().catch(() => ({}));
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("DeepSeek returned an unexpected response.");
  }

  const result = parseJsonContent(content);
  if (!result) {
    throw new Error("Could not parse definition from the response.");
  }

  return result;
}
