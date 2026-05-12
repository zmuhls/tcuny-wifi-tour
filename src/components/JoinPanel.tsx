import { FormEvent, useState } from "react";
import { LogIn, UserRound } from "lucide-react";
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
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = onJoin({ displayName, teamName, accessCode });
    setMessage(result.message);
  }

  if (contributor) {
    return (
      <section className="join-panel joined">
        <div>
          <p className="eyebrow">Contributing as</p>
          <strong>{contributor.displayName}</strong>
          <span>{contributor.teamName}</span>
        </div>
        <button className="icon-button text-button" type="button" onClick={onLeave}>
          <UserRound size={17} />
          Switch
        </button>
      </section>
    );
  }

  return (
    <form className="join-panel" onSubmit={submit}>
      <p className="eyebrow">Access code required to ping</p>
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
      <button className="primary-button" type="submit">
        <LogIn size={18} />
        Join tour
      </button>
      {message ? <p className="form-note">{message}</p> : null}
    </form>
  );
}
