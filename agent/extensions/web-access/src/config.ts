const MISSING_KEY_MESSAGE = `GEMINI_API_KEY is not set.

Add it to ~/.pi/agent/configs/.env:

  GEMINI_API_KEY=AIza...your-key-here

Get a free key at: https://aistudio.google.com/apikey

Note: if you already have Gemini configured as a model in pi, the key is
picked up automatically from your environment — no extra config needed.`;

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error(MISSING_KEY_MESSAGE);
  return key;
}
