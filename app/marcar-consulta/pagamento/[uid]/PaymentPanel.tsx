"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startPaymentAction } from "./actions";

export interface PaymentPanelProps {
  uid: string;
  amount: string;
  bookingStatus: string;
  paid: boolean;
  open: { method: "mbway" | "multibanco"; expiresAt: string; entity: string | null; reference: string | null; phoneHint: string | null } | null;
  lastFailed: "mbway" | "multibanco" | null;
  canMultibanco: boolean;
  holdUntil: string;
  defaultPhone: string;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function PaymentPanel(p: PaymentPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(p.defaultPhone);
  const done = p.paid || p.bookingStatus === "accepted";
  const closed = !done && p.bookingStatus !== "pending";

  // Enquanto se espera pelo pagamento, verifica o estado de 5 em 5 segundos.
  useEffect(() => {
    if (done || closed) return;
    const snapshot = JSON.stringify([p.bookingStatus, p.paid, p.open?.method ?? null]);
    const timer = setInterval(async () => {
      const res = await fetch(`/api/pagamentos/${p.uid}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const s = await res.json();
      if (JSON.stringify([s.bookingStatus, s.paid, s.open?.method ?? null]) !== snapshot) router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [done, closed, p.uid, p.bookingStatus, p.paid, p.open?.method, router]);

  function start(method: "mbway" | "multibanco") {
    setError(null);
    startTransition(async () => {
      const message = await startPaymentAction(p.uid, method, phone);
      if (message) setError(message);
      else router.refresh();
    });
  }

  if (done) {
    return (
      <div className="booking-card booking-success">
        <div className="booking-success-icon">✓</div>
        <h3>Pagamento recebido!</h3>
        <p>A tua consulta está confirmada. Vais receber a confirmação por email.</p>
        <Link href="/" className="btn-outline">Voltar ao início</Link>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="booking-card booking-success">
        <h3>Marcação cancelada</h3>
        <p>O prazo para pagar terminou e o horário foi libertado. Podes fazer uma nova marcação.</p>
        <Link href="/marcar-consulta" className="btn-primary">Marcar de novo</Link>
      </div>
    );
  }

  if (p.open?.method === "mbway") {
    return (
      <div className="booking-card pay-waiting">
        <div className="pay-spinner" aria-hidden />
        <h3>Aprova o pagamento na app MB WAY</h3>
        <p>
          Enviámos um pedido de <strong>{p.amount}</strong> para o telemóvel {p.open.phoneHint}. Abre a app MB WAY e
          aprova até às <strong>{time(p.open.expiresAt)}</strong>. Esta página atualiza sozinha.
        </p>
      </div>
    );
  }

  if (p.open?.method === "multibanco") {
    return (
      <div className="booking-card">
        <h3 className="booking-step-title">Paga por Multibanco</h3>
        <dl className="pay-ref">
          <dt>Entidade</dt><dd>{p.open.entity}</dd>
          <dt>Referência</dt><dd>{p.open.reference?.replace(/(\d{3})(?=\d)/g, "$1 ")}</dd>
          <dt>Valor</dt><dd>{p.amount}</dd>
        </dl>
        <p className="booking-muted">
          Paga no multibanco ou no homebanking até{" "}
          <strong>{dateTime(new Date(new Date(p.open.expiresAt).getTime() - 60000).toISOString())}</strong>. A marcação fica
          confirmada assim que o pagamento chegar (recebes um email). Podes fechar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="booking-card">
      <h3 className="booking-step-title">Escolhe como pagar</h3>
      <p className="booking-muted">
        A marcação fica reservada até às <strong>{time(p.holdUntil)}</strong>. Só fica confirmada depois do pagamento.
      </p>
      {p.lastFailed === "mbway" && (
        <p className="booking-error">O pedido MB WAY anterior expirou ou foi recusado. Podes tentar outra vez.</p>
      )}
      <div className="pay-methods">
        <div className="pay-method">
          <strong>MB WAY</strong>
          <label>
            Telemóvel
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </label>
          <button type="button" className="btn-primary" disabled={pending} onClick={() => start("mbway")}>
            {pending ? "A enviar…" : `Pagar ${p.amount} com MB WAY`}
          </button>
        </div>
        <div className="pay-method">
          <strong>Referência Multibanco</strong>
          {p.canMultibanco ? (
            <>
              <p className="booking-muted">Recebes entidade e referência para pagar até ao fim do dia de amanhã.</p>
              <button type="button" className="btn-outline" disabled={pending} onClick={() => start("multibanco")}>
                Gerar referência
              </button>
            </>
          ) : (
            <p className="booking-muted">Disponível só para consultas a mais de 48 horas. Usa o MB WAY.</p>
          )}
        </div>
      </div>
      {error && <p className="booking-error">{error}</p>}
    </div>
  );
}
