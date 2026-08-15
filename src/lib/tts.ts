import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { EdgeTTS } from "node-edge-tts";

// Map deck language (locale) -> Edge TTS voice + language tag.
const VOICES: Record<string, { voice: string; lang: string }> = {
  "en-US": { voice: "en-US-AriaNeural", lang: "en-US" },
  "en-GB": { voice: "en-GB-SoniaNeural", lang: "en-GB" },
  "en-AU": { voice: "en-AU-NatashaNeural", lang: "en-AU" },
  "es-ES": { voice: "es-ES-ElviraNeural", lang: "es-ES" },
  "es-MX": { voice: "es-MX-DaliaNeural", lang: "es-MX" },
  "fr-FR": { voice: "fr-FR-DeniseNeural", lang: "fr-FR" },
  "de-DE": { voice: "de-DE-KatjaNeural", lang: "de-DE" },
  "it-IT": { voice: "it-IT-ElsaNeural", lang: "it-IT" },
  "pt-PT": { voice: "pt-PT-RaquelNeural", lang: "pt-PT" },
  "pt-BR": { voice: "pt-BR-FranciscaNeural", lang: "pt-BR" },
  "nl-NL": { voice: "nl-NL-ColetteNeural", lang: "nl-NL" },
  "ru-RU": { voice: "ru-RU-SvetlanaNeural", lang: "ru-RU" },
  "ja-JP": { voice: "ja-JP-NanamiNeural", lang: "ja-JP" },
  "zh-CN": { voice: "zh-CN-XiaoxiaoNeural", lang: "zh-CN" },
  "ko-KR": { voice: "ko-KR-SunHiNeural", lang: "ko-KR" },
  "ar-SA": { voice: "ar-SA-ZariyahNeural", lang: "ar-SA" },
  "hi-IN": { voice: "hi-IN-SwaraNeural", lang: "hi-IN" },
  "tr-TR": { voice: "tr-TR-EmelNeural", lang: "tr-TR" },
  "pl-PL": { voice: "pl-PL-ZofiaNeural", lang: "pl-PL" },
  "sv-SE": { voice: "sv-SE-SofieNeural", lang: "sv-SE" },
};

const DEFAULT_VOICE = { voice: "en-US-AriaNeural", lang: "en-US" };

export function voiceForLanguage(language: string): {
  voice: string;
  lang: string;
} {
  return VOICES[language] ?? DEFAULT_VOICE;
}

// Generate MP3 bytes for the given text using Edge's free TTS.
export async function synthesize(
  text: string,
  language: string
): Promise<Uint8Array<ArrayBuffer>> {
  const { voice, lang } = voiceForLanguage(language);

  const tmpPath = path.join(
    os.tmpdir(),
    `flashcard-tts-${crypto.randomUUID()}.mp3`
  );

  const tts = new EdgeTTS({
    voice,
    lang,
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    timeout: 30000,
  });

  try {
    await tts.ttsPromise(text, tmpPath);
    const bytes = await fs.readFile(tmpPath);
    return new Uint8Array(bytes);
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
