"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(login, null);
  return (
    <form action={formAction} className="admin-form">
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
