"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { describeWeekdays, type AvailableDay, type BookingField, type Location } from "@/lib/booking/types";
import { formatDateLong } from "@/lib/booking/time";
import { requestBooking, type BookingFormState } from "./actions";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEK_HEADER = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Células do mês (YYYY-MM-DD ou null para espaços), semana a começar à segunda. */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

function CustomField({ field }: { field: BookingField }) {
  const name = `field:${field.slug}`;
  const label = (
    <>
      {field.label} {!field.required && <small>(opcional)</small>}
    </>
  );
  if (field.type === "radio" || field.type === "checkbox") {
    return (
      <fieldset className="full booking-options">
        <legend>{label}</legend>
        {field.options.map((option) => (
          <label key={option}>
            <input type={field.type} name={name} value={option} required={field.required && field.type === "radio"} />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="full booking-consent">
        <input type="checkbox" name={name} value="sim" required={field.required} />
        {field.label}
      </label>
    );
  }
  return (
    <label className={field.type === "textarea" ? "full" : undefined}>
      {label}
      {field.type === "textarea" ? (
        <textarea name={name} rows={3} required={field.required} />
      ) : field.type === "select" ? (
        <select name={name} required={field.required} defaultValue="">
          <option value="" disabled>
            Escolhe…
          </option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input name={name} type={field.type === "number" ? "number" : "text"} required={field.required} />
      )}
    </label>
  );
}

export default function BookingWizard({ locations }: { locations: Location[] }) {
  const [location, setLocation] = useState<Location | null>(null);
  const [days, setDays] = useState<AvailableDay[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [month, setMonth] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    async (prev, formData) => {
      const result = await requestBooking(prev, formData);
      if (result.status === "slot-taken") {
        setTime(null);
        setReloadKey((k) => k + 1);
      }
      return result;
    },
    { status: "idle" },
  );

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    fetch(`/api/disponibilidade?local=${encodeURIComponent(location.id)}`)
      .then((r) => r.json())
      .catch(() => ({}))
      .then((data: { days?: AvailableDay[] }) => {
        if (cancelled) return;
        setLoadError(!data.days);
        const list = data.days ?? [];
        setDays(list);
        setMonth((current) => current || (list[0]?.date ?? new Date().toISOString()).slice(0, 7));
      });
    return () => {
      cancelled = true;
    };
  }, [location, reloadKey]);

  const byDate = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.slots])), [days]);
  const firstMonth = days?.[0]?.date.slice(0, 7);
  const lastMonth = days?.at(-1)?.date.slice(0, 7);

  function chooseLocation(l: Location) {
    setLocation(l);
    setDays(null);
    setMonth("");
    setDate(null);
    setTime(null);
  }

  if (state.status === "success") {
    return (
      <div className="booking-card booking-success">
        <div className="booking-success-icon">✓</div>
        <h3>{state.pending ? "Pedido enviado!" : "Consulta marcada!"}</h3>
        {state.pending ? (
          <p>
            A tua consulta ficou <strong>pendente</strong> e aguarda confirmação da nutricionista.
            Vais receber um email assim que for confirmada.
          </p>
        ) : (
          <p>Obrigada! Vais receber a confirmação da consulta por email.</p>
        )}
        <Link href="/" className="btn-outline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="booking">
      <div className="booking-card">
        <h3 className="booking-step-title">
          <span>1</span> Que consulta queres marcar?
        </h3>
        <div className="booking-locations">
          {locations.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`booking-location${location?.id === l.id ? " selected" : ""}`}
              onClick={() => chooseLocation(l)}
            >
              <strong>{l.name}</strong>
              <span>
                {l.lengthInMinutes} min{l.address && ` · ${l.address}`}
              </span>
              {l.weekdays.length > 0 && <small>{describeWeekdays(l.weekdays)}</small>}
            </button>
          ))}
        </div>
      </div>

      {location && (
        <div className="booking-card">
          <h3 className="booking-step-title">
            <span>2</span> Escolhe o dia e a hora
          </h3>
          {state.status === "slot-taken" && !time && <p className="booking-error">{state.message}</p>}
          {days === null ? (
            <p className="booking-muted">A carregar horários…</p>
          ) : loadError ? (
            <p className="booking-error">
              Não foi possível carregar a agenda. Tenta de novo daqui a pouco ou contacta-me por
              WhatsApp.
            </p>
          ) : days.length === 0 ? (
            <p className="booking-muted">
              De momento não há horários disponíveis para este local. Experimenta outro local ou
              contacta-me por WhatsApp.
            </p>
          ) : (
            <div className="booking-schedule">
              <div className="calendar">
                <div className="calendar-header">
                  <button
                    type="button"
                    onClick={() => setMonth(shiftMonth(month, -1))}
                    disabled={!firstMonth || month <= firstMonth}
                    aria-label="Mês anterior"
                  >
                    ‹
                  </button>
                  <span>
                    {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonth(shiftMonth(month, 1))}
                    disabled={!lastMonth || month >= lastMonth}
                    aria-label="Mês seguinte"
                  >
                    ›
                  </button>
                </div>
                <div className="calendar-grid">
                  {WEEK_HEADER.map((d) => (
                    <div key={d} className="calendar-weekday">
                      {d}
                    </div>
                  ))}
                  {monthCells(month).map((cell, i) =>
                    cell ? (
                      <button
                        key={cell}
                        type="button"
                        disabled={!byDate.has(cell)}
                        className={`calendar-day${date === cell ? " selected" : ""}`}
                        onClick={() => {
                          setDate(cell);
                          setTime(null);
                        }}
                      >
                        {Number(cell.slice(8))}
                      </button>
                    ) : (
                      <div key={`empty-${i}`} />
                    ),
                  )}
                </div>
              </div>

              <div className="booking-times">
                {date && byDate.has(date) ? (
                  <>
                    <p className="booking-times-date">{formatDateLong(date)}</p>
                    <div className="booking-slots">
                      {byDate.get(date)!.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.free}
                          aria-label={slot.free ? undefined : `${slot.time}, ocupado`}
                          className={`booking-slot${time === slot.time ? " selected" : ""}`}
                          onClick={() => setTime(slot.time)}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="booking-muted">Seleciona um dia disponível no calendário.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {location && date && time && (
        <form className="booking-card" action={formAction}>
          <h3 className="booking-step-title">
            <span>3</span> Os teus dados
          </h3>
          <div className="booking-summary">
            <strong>{location.name}</strong> · {formatDateLong(date)} às {time}
          </div>

          <input type="hidden" name="locationId" value={location.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="booking-hp" />

          <div className="booking-fields">
            <label>
              Nome
              <input name="name" required autoComplete="name" />
            </label>
            <label>
              Telefone
              <input name="phone" type="tel" required autoComplete="tel" />
            </label>
            <label className="full">
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            {location.fields.map((f) => (
              <CustomField key={f.slug} field={f} />
            ))}
            <label className="full">
              Motivo da consulta <small>(opcional)</small>
              <textarea name="notes" rows={3} />
            </label>
            <label className="full booking-consent">
              <input type="checkbox" name="consent" required />
              Aceito que os meus dados sejam usados apenas para gerir este pedido de consulta.
            </label>
          </div>

          {state.status === "error" && <p className="booking-error">{state.message}</p>}

          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "A enviar…" : "Pedir marcação"}
          </button>
        </form>
      )}
    </div>
  );
}
