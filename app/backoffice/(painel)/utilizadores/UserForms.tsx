"use client";

import { useActionState } from "react";
import { submitKeepingValues } from "../../submitKeepingValues";
import { createUser, userAction, type UserFormState } from "../actions";

function TemporaryPassword({ state }: { state: UserFormState }) {
  if (state.error) return <p className="bo-error">{state.error}</p>;
  if (!state.created) return null;
  return (
    <div className="bo-notice">
      Palavra-passe temporária de <strong>{state.created.email}</strong> (só é mostrada agora):
      <br />
      <code>{state.created.password}</code>
      <p className="bo-small bo-muted">
        Envia-a por um canal seguro. No primeiro login é pedido para configurar o 2FA; depois pode mudá-la em Conta.
      </p>
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, {});
  return (
    <form onSubmit={submitKeepingValues(action)} className="bo-form bo-card">
      <div className="bo-grid-2">
        <label>
          Nome
          <input name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
      </div>
      <label>
        Perfil
        <select name="role" defaultValue="operacao">
          <option value="operacao">Operação (ex.: Filipa)</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <TemporaryPassword state={state} />
      <button type="submit" className="bo-btn" disabled={pending}>
        {pending ? "A criar…" : "Criar utilizador"}
      </button>
    </form>
  );
}

const CONFIRM: Record<string, string> = {
  "repor-2fa": "Repor o 2FA? A pessoa terá de voltar a ler o código QR no próximo login.",
  "repor-palavra-passe": "Gerar uma nova palavra-passe temporária? As sessões abertas são terminadas.",
  desativar: "Desativar esta conta? Deixa de conseguir entrar.",
  ativar: "Reativar esta conta?",
};

export function UserActions({ userId, disabled, self }: { userId: string; disabled: boolean; self: boolean }) {
  const [state, action, pending] = useActionState(userAction, {});
  const buttons = self
    ? (["repor-palavra-passe"] as const)
    : (["repor-2fa", "repor-palavra-passe", disabled ? "ativar" : "desativar"] as const);
  const labels = { "repor-2fa": "Repor 2FA", "repor-palavra-passe": "Nova palavra-passe", desativar: "Desativar", ativar: "Ativar" };
  return (
    <>
      <form
        className="bo-inline-form"
        onSubmit={(e) => {
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter && !window.confirm(CONFIRM[submitter.value])) return e.preventDefault();
          submitKeepingValues(action)(e);
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        {buttons.map((b) => (
          <button
            key={b}
            type="submit"
            name="action"
            value={b}
            disabled={pending}
            className={`bo-btn bo-btn-small ${b === "desativar" ? "bo-btn-danger" : "bo-btn-ghost"}`}
          >
            {labels[b]}
          </button>
        ))}
      </form>
      <TemporaryPassword state={state} />
    </>
  );
}
