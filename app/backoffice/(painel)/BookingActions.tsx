"use client";

import { useState, useTransition } from "react";
import { bookingAction, type BookingAction } from "./actions";

const LABELS: Record<BookingAction, string> = { confirmar: "Confirmar", recusar: "Recusar", cancelar: "Cancelar" };
const QUESTIONS: Record<BookingAction, string> = {
  confirmar: "Confirmar esta marcação? A cliente recebe o email de confirmação do Cal.com.",
  recusar: "Motivo da recusa (enviado à cliente):",
  cancelar: "Motivo do cancelamento (enviado à cliente):",
};

export default function BookingActions({ uid, actions }: { uid: string; actions: BookingAction[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: BookingAction) {
    let reason = "";
    if (action === "confirmar") {
      if (!window.confirm(QUESTIONS[action])) return;
    } else {
      const answer = window.prompt(QUESTIONS[action]);
      if (answer === null) return;
      reason = answer;
    }
    startTransition(async () => setError(await bookingAction(uid, action, reason)));
  }

  return (
    <div className="bo-booking-actions">
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          disabled={pending}
          className={`bo-btn bo-btn-small${a === "confirmar" ? "" : " bo-btn-danger"}`}
          onClick={() => run(a)}
        >
          {pending ? "…" : LABELS[a]}
        </button>
      ))}
      {error && <p className="bo-error bo-small">{error}</p>}
    </div>
  );
}
