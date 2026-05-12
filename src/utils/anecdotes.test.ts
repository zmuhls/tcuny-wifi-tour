import { describe, expect, it } from "vitest";
import {
  ANECDOTE_WORD_LIMIT,
  countAnecdoteWords,
  normalizeAnecdoteBody,
  validateAnecdoteBody,
} from "./anecdotes";

describe("anecdote validation", () => {
  it("normalizes spacing before storing a wall note", () => {
    expect(normalizeAnecdoteBody("  Eduroam   failed\nthen Guest worked. ")).toBe(
      "Eduroam failed then Guest worked.",
    );
  });

  it("counts words after trimming and collapsing whitespace", () => {
    expect(countAnecdoteWords("  one   two\nthree ")).toBe(3);
  });

  it("accepts a 100-word anecdote", () => {
    const body = Array.from({ length: ANECDOTE_WORD_LIMIT }, (_, index) =>
      `word${index}`,
    ).join(" ");

    expect(validateAnecdoteBody(body)).toMatchObject({
      ok: true,
      wordCount: ANECDOTE_WORD_LIMIT,
    });
  });

  it("rejects blank and over-limit anecdotes", () => {
    expect(validateAnecdoteBody("   ")).toMatchObject({ ok: false });

    const body = Array.from({ length: ANECDOTE_WORD_LIMIT + 1 }, (_, index) =>
      `word${index}`,
    ).join(" ");

    expect(validateAnecdoteBody(body)).toMatchObject({
      ok: false,
      wordCount: ANECDOTE_WORD_LIMIT + 1,
    });
  });
});
