"use client";

import { useActionState } from "react";
import { enterSite } from "./actions";

export default function AccessForm({ next }: { next: string }) {
  const [error, formAction, pending] = useActionState(enterSite, null);
  return (
    <form action={formAction} className="admin-form">
      <input type="hidden" name="next" value={next} />
      <label>
        Palavra-passe
        <input type="password" name="password" required autoFocus autoComplete="current-password" />
      </label>
      {error && <p className="booking-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
