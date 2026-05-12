import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, MessageSquareQuote, Send } from "lucide-react";
import type { AnecdoteRecord, Contributor } from "../types";
import {
  ANECDOTE_WORD_LIMIT,
  countAnecdoteWords,
  normalizeAnecdoteBody,
} from "../utils/anecdotes";

interface WifiWallPanelProps {
  contributor: Contributor | null;
  anecdotes: AnecdoteRecord[];
  onAdd: (input: { body: string; accessCode: string }) => {
    ok: boolean;
    message: string;
  };
}

export function WifiWallPanel({
  contributor,
  anecdotes,
  onAdd,
}: WifiWallPanelProps) {
  const [accessCode, setAccessCode] = useState(contributor?.accessCode ?? "");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const wordCount = useMemo(() => countAnecdoteWords(body), [body]);
  const overLimit = wordCount > ANECDOTE_WORD_LIMIT;

  useEffect(() => {
    if (contributor?.accessCode) {
      setAccessCode(contributor.accessCode);
    }
  }, [contributor?.accessCode]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = onAdd({ body, accessCode });
    setMessage(result.message);

    if (result.ok) {
      setBody("");
    }
  }

  return (
    <details className="wifi-wall-panel">
      <summary>
        <span className="wall-summary-main">
          <MessageSquareQuote size={17} />
          <span>
            <strong>Bathroom Wall</strong>
            <small>CUNY Wi-Fi anecdotes</small>
          </span>
        </span>
        <span className="wall-summary-meta">
          {anecdotes.length}
          <ChevronDown size={16} />
        </span>
      </summary>

      <div className="wall-panel-body">
        <form className="wall-form" onSubmit={submit}>
          <label>
            Access code
            <input
              required
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="TCUNY2026"
              autoCapitalize="characters"
            />
          </label>
          <label>
            Note
            <textarea
              required
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="A CUNY Wi-Fi story, workaround, frustration, or tiny victory."
            />
          </label>
          <div className="wall-form-footer">
            <span className={overLimit ? "word-count over-limit" : "word-count"}>
              {wordCount}/{ANECDOTE_WORD_LIMIT}
            </span>
            <button
              className="primary-button wall-submit"
              type="submit"
              disabled={overLimit}
            >
              <Send size={16} />
              Post
            </button>
          </div>
          <p className="form-note">
            Signed as {contributor?.displayName || "anonymous"}.
          </p>
          {message ? <p className="form-note">{message}</p> : null}
        </form>

        {anecdotes.length ? (
          <ol className="wall-note-list" aria-label="CUNY Wi-Fi anecdotes">
            {anecdotes.slice(0, 5).map((anecdote) => (
              <li className="wall-note" key={anecdote.id}>
                <p>{normalizeAnecdoteBody(anecdote.body)}</p>
                <span>
                  {anecdote.contributorName} / {anecdote.teamName} /{" "}
                  {formatWallTime(anecdote.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="wall-empty">No wall notes yet.</p>
        )}
      </div>
    </details>
  );
}

function formatWallTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
