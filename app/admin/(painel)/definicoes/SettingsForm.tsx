"use client";

import { useState, useTransition } from "react";
import { WEEKDAY_NAMES, type BookingConfig, type Location, type Weekday } from "@/lib/booking/types";
import { formatDateLong } from "@/lib/booking/time";
import { saveSettings } from "../../actions";

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export default function SettingsForm({ initialConfig }: { initialConfig: BookingConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [newBlocked, setNewBlocked] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<BookingConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setResult(null);
  }

  function setHours(day: Weekday, value: BookingConfig["hours"][number]) {
    update({ hours: config.hours.map((h, i) => (i === day ? value : h)) });
  }

  function updateLocation(index: number, patch: Partial<Location>) {
    update({ locations: config.locations.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  }

  function toggleLocationDay(index: number, day: Weekday) {
    const days = config.locations[index].weekdays;
    updateLocation(index, {
      weekdays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    });
  }

  function save() {
    startTransition(async () => setResult(await saveSettings(config)));
  }

  return (
    <div className="admin-settings">
      <section className="admin-card">
        <h2>Horário de trabalho</h2>
        <p className="booking-muted">Horas em que aceitas consultas, em cada dia da semana.</p>
        <div className="hours-table">
          {WEEK_ORDER.map((day) => {
            const h = config.hours[day];
            return (
              <div key={day} className="hours-row">
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={!!h}
                    onChange={(e) => setHours(day, e.target.checked ? { start: "13:00", end: "19:00" } : null)}
                  />
                  {WEEKDAY_NAMES[day]}
                </label>
                {h ? (
                  <div className="hours-inputs">
                    <input type="time" value={h.start} onChange={(e) => setHours(day, { ...h, start: e.target.value })} />
                    <span>às</span>
                    <input type="time" value={h.end} onChange={(e) => setHours(day, { ...h, end: e.target.value })} />
                  </div>
                ) : (
                  <span className="booking-muted">Indisponível</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="admin-card">
        <h2>Consultas</h2>
        <div className="admin-grid">
          <label>
            Duração de cada consulta (minutos)
            <input
              type="number"
              min={10}
              max={240}
              step={5}
              value={config.slotMinutes}
              onChange={(e) => update({ slotMinutes: Number(e.target.value) })}
            />
          </label>
          <label>
            Antecedência mínima (horas)
            <input
              type="number"
              min={0}
              value={config.minNoticeHours}
              onChange={(e) => update({ minNoticeHours: Number(e.target.value) })}
            />
          </label>
          <label>
            Permitir marcações até (dias)
            <input
              type="number"
              min={1}
              max={365}
              value={config.maxDaysAhead}
              onChange={(e) => update({ maxDaysAhead: Number(e.target.value) })}
            />
          </label>
          <label>
            Email para notificações
            <input
              type="email"
              value={config.notificationEmail}
              onChange={(e) => update({ notificationEmail: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <h2>Locais</h2>
        <p className="booking-muted">Em que dias da semana cada local aceita consultas.</p>
        <div className="locations-list">
          {config.locations.map((l, i) => (
            <div key={l.id || `novo-${i}`} className="location-edit">
              <div className="admin-grid">
                <label>
                  Nome
                  <input value={l.name} onChange={(e) => updateLocation(i, { name: e.target.value })} />
                </label>
                <label>
                  Morada / descrição
                  <input value={l.address} onChange={(e) => updateLocation(i, { address: e.target.value })} />
                </label>
              </div>
              <div className="weekday-toggles">
                {WEEK_ORDER.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={l.weekdays.includes(day) ? "on" : ""}
                    onClick={() => toggleLocationDay(i, day)}
                  >
                    {WEEKDAY_NAMES[day].slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className="location-flags">
                <label className="admin-check">
                  <input type="checkbox" checked={l.online} onChange={(e) => updateLocation(i, { online: e.target.checked })} />
                  Online
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={l.active} onChange={(e) => updateLocation(i, { active: e.target.checked })} />
                  Visível no site
                </label>
                <button
                  type="button"
                  className="admin-link-danger"
                  onClick={() => update({ locations: config.locations.filter((_, j) => j !== i) })}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={() =>
            update({
              locations: [
                ...config.locations,
                { id: "", name: "", address: "", online: false, weekdays: [], active: true },
              ],
            })
          }
        >
          + Adicionar local
        </button>
      </section>

      <section className="admin-card">
        <h2>Dias bloqueados</h2>
        <p className="booking-muted">Férias, feriados ou dias em que não dás consultas.</p>
        <div className="blocked-add">
          <input type="date" value={newBlocked} onChange={(e) => setNewBlocked(e.target.value)} />
          <button
            type="button"
            className="btn-outline"
            disabled={!newBlocked}
            onClick={() => {
              update({ blockedDates: [...new Set([...config.blockedDates, newBlocked])].sort() });
              setNewBlocked("");
            }}
          >
            Bloquear dia
          </button>
        </div>
        <div className="blocked-list">
          {config.blockedDates.map((d) => (
            <span key={d} className="pill">
              {formatDateLong(d)}
              <button
                type="button"
                aria-label="Remover"
                onClick={() => update({ blockedDates: config.blockedDates.filter((x) => x !== d) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <div className="admin-save">
        {result && <p className={result.ok ? "admin-ok" : "booking-error"}>{result.message}</p>}
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>
          {pending ? "A guardar…" : "Guardar definições"}
        </button>
      </div>
    </div>
  );
}
