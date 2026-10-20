"use client";

import { useActionState } from "react";
import { submitKeepingValues } from "../../submitKeepingValues";
import { changePassword } from "../actions";

export default function PasswordForm() {
  const [result, action, pending] = useActionState(changePassword, null);
  return (
    <form onSubmit={submitKeepingValues(action)} className="bo-form bo-card" style={{ maxWidth: 420 }}>
      <label>
        Palavra-passe atual
        <input type="password" name="current" required autoComplete="current-password" />
      </label>
      <label>
        Nova palavra-passe <span className="bo-small">(mínimo 12 caracteres)</span>
        <input type="password" name="next" required minLength={12} autoComplete="new-password" />
      </label>
      <label>
        Repetir a nova palavra-passe
        <input type="password" name="confirm" required minLength={12} autoComplete="new-password" />
      </label>
      {result === "ok" ? (
        <p className="bo-ok">Palavra-passe alterada. As outras sessões foram terminadas.</p>
      ) : (
        result && <p className="bo-error">{result}</p>
      )}
      <button type="submit" className="bo-btn" disabled={pending}>
        {pending ? "A guardar…" : "Mudar palavra-passe"}
      </button>
    </form>
  );
}
