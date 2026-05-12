export const ANECDOTE_WORD_LIMIT = 100;

export function normalizeAnecdoteBody(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function countAnecdoteWords(value: string) {
  const normalized = normalizeAnecdoteBody(value);
  return normalized ? normalized.split(" ").length : 0;
}

export function validateAnecdoteBody(value: string) {
  const body = normalizeAnecdoteBody(value);
  const wordCount = countAnecdoteWords(body);

  if (!body) {
    return {
      ok: false,
      body,
      wordCount,
      message: "Write a short CUNY Wi-Fi anecdote before posting.",
    };
  }

  if (wordCount > ANECDOTE_WORD_LIMIT) {
    return {
      ok: false,
      body,
      wordCount,
      message: `Keep it to ${ANECDOTE_WORD_LIMIT} words or fewer.`,
    };
  }

  return {
    ok: true,
    body,
    wordCount,
    message: "Posted to the wall.",
  };
}
