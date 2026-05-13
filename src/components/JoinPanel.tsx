import { FormEvent, useEffect, useState } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import type { Contributor } from "../types";

interface JoinPanelProps {
  contributor: Contributor | null;
  onJoin: (input: {
    displayName: string;
    teamName: string;
    accessCode: string;
  }) => { ok: boolean; message: string };
  onLeave: () => void;
}

export function JoinPanel({ contributor, onJoin, onLeave }: JoinPanelProps) {
  const [editing, setEditing] = useState(!contributor);
  const [displayName, setDisplayName] = useState(contributor?.displayName ?? "");
  const [teamName, setTeamName] = useState(contributor?.teamName ?? "");
  const [accessCode, setAccessCode] = useState(contributor?.accessCode ?? "");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDisplayName(contributor?.displayName ?? "");
    setTeamName(contributor?.teamName ?? "");
    setAccessCode(contributor?.accessCode ?? "");
    setEditing(!contributor);
    setMessage("");
  }, [contributor]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = onJoin({ displayName, teamName, accessCode });
    setMessage(result.message);
    if (result.ok) {
      setEditing(false);
    }
  }

  if (contributor && !editing) {
    return (
      <section className="join-panel joined">
        <div>
          <p className="eyebrow">Contributing as</p>
          <strong>{contributor.displayName}</strong>
          <span>{contributor.teamName}</span>
        </div>
        <button
          className="icon-button text-button"
          type="button"
          onClick={() => setEditing(true)}
        >
          <UserRound size={17} />
          Edit / switch
        </button>
      </section>
    );
  }

  return (
    <form className="join-panel" onSubmit={submit}>
      <div className="join-form-header">
        <p className="eyebrow">
          {contributor ? "Edit participant" : "Access code required to ping"}
        </p>
        {contributor ? (
          <button
            className="text-button compact-button"
            type="button"
            onClick={() => {
              setEditing(false);
              setDisplayName(contributor.displayName);
              setTeamName(contributor.teamName);
              setAccessCode(contributor.accessCode);
              setMessage("");
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <label>
        Name
        <input
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Your name"
        />
      </label>
      <label>
        Team
        <input
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="Pod or team name"
        />
      </label>
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
      <div className="join-actions">
        <button className="primary-button" type="submit">
          <LogIn size={18} />
          {contributor ? "Save participant" : "Join tour"}
        </button>
        {contributor ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              onLeave();
              setEditing(true);
              setDisplayName("");
              setTeamName("");
              setAccessCode("");
              setMessage("Saved participant cleared on this device.");
            }}
          >
            <LogOut size={17} />
            Clear
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="form-note" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
