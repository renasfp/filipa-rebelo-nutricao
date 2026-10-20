"use client";

import { useActionState, type ReactNode } from "react";
import { submitKeepingValues } from "./submitKeepingValues";

/** Formulário simples ligado a uma Server Action que devolve uma mensagem de erro (ou null). */
export default function ActionForm({
  action,
  submit,
  pending,
  children,
}: {
  action: (prev: string | null, formData: FormData) => Promise<string | null>;
  submit: string;
  pending: string;
  children: ReactNode;
}) {
  const [error, formAction, isPending] = useActionState(action, null);
  return (
    <form onSubmit={submitKeepingValues(formAction)} className="bo-form">
      {children}
      {error && <p className="bo-error">{error}</p>}
      <button type="submit" className="bo-btn" disabled={isPending}>
        {isPending ? pending : submit}
      </button>
    </form>
  );
}
