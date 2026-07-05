const MISSING_KEY_MESSAGE = `GEMINI_API_KEY is not set.

Add it to your shell profile (e.g. ~/.zshrc):

  export GEMINI_API_KEY="AIza...your-key-here"

Get a free key at: https://aistudio.google.com/apikey

Note: avoid running commands that print the full environment (like env, set, printenv)
when a model is watching — keys in the shell environment are visible to the bash tool.`;

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error(MISSING_KEY_MESSAGE);
  return key;
}
