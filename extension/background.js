const DEFAULTS = {
  siteUrl: "https://filipa-rebelo-nutricao.vercel.app",
  token: "",
  workplaceId: "553322",
  professionalId: "533544",
  countryId: "183",
  // O que fazer no Nutrium quando a marcação é cancelada/recusada no Cal.com: "cancel" | "delete".
  onCancel: "cancel",
};
const AUTO_SYNC_MINUTES = 10;
const AGENDA_DAYS = 90;
// Janela da agenda do Nutrium enviada ao site (para a agenda do backoffice).
const SHARE_PAST_DAYS = 35;
const SHARE_FUTURE_DAYS = 120;
const NUTRIUM_TABS = "https://*.nutrium.com/*";
// scheduling_status_id no Nutrium.
const N_CONFIRMED = 0;
const N_UNCONFIRMED = 1;
const N_CANCELLED = 2;

let running = null;

async function settings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const s = { ...DEFAULTS, ...stored };
  return {
    ...s,
    siteUrl: s.siteUrl.replace(/\/$/, ""),
    config: { workplaceId: s.workplaceId, professionalId: s.professionalId, countryId: s.countryId },
  };
}

async function api(s, path, init = {}) {
  if (!s.token) throw new Error("Falta o token. Abre as opções da extensão.");
  const res = await fetch(`${s.siteUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status} ao contactar o site`);
  return body;
}

const isActive = (b) => b.status === "pendente" || b.status === "confirmada";

/** O que falta fazer no Nutrium para esta marcação (ou null se já está em dia). */
function pendingAction(b, onCancel) {
  if (!b.synced) return isActive(b) ? "create" : null;
  if (b.synced.version === b.version) return null;
  return isActive(b) ? "update" : onCancel;
}

async function nutriumTab(preferred) {
  const tabId = preferred ?? (await chrome.tabs.query({ url: NUTRIUM_TABS }))[0]?.id;
  if (!tabId) throw new Error("Abre o Nutrium numa aba e tenta de novo.");
  return tabId;
}

/** Corre window.__calNutrium[method](...args) dentro da aba do Nutrium. */
async function inNutrium(tabId, method, ...args) {
  await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["nutrium.js"] });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (method, args) => {
      try {
        return { ok: true, value: await window.__calNutrium[method](...args) };
      } catch (err) {
        return { ok: false, error: String(err?.message ?? err) };
      }
    },
    args: [method, args],
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Aplica a marcação do Cal.com no Nutrium e regista a ligação no site. */
async function applyToNutrium(s, tabId, b, action) {
  const { appointmentId, patientId } = await inNutrium(tabId, "run", action, b, b.synced, s.config);
  await api(s, "/api/nutrium/marcacoes", {
    method: "POST",
    body: JSON.stringify({ uid: b.uid, nutriumId: appointmentId, patientId, version: b.version }),
  });
  b.synced = { nutriumId: appointmentId, patientId, version: b.version, syncedAt: new Date().toISOString() };
}

const sameTime = (a, b) => new Date(a).getTime() === new Date(b).getTime();
const when = (iso) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" });

/**
 * Agenda unificada: cada entrada diz onde a consulta existe (Cal.com, Nutrium ou ambos)
 * e, se houver diferenças, que correções são possíveis.
 */
function buildAgenda(bookings, appointments, results, from) {
  const byId = new Map(appointments.map((a) => [a.id, a]));
  const linked = new Set();
  const entries = [];

  for (const b of bookings) {
    if (new Date(b.end) < new Date(from)) continue;
    const a = b.synced ? byId.get(b.synced.nutriumId) : null;
    if (a) linked.add(a.id);
    const nutriumActive = a && a.status !== N_CANCELLED;
    if (!isActive(b) && !nutriumActive) continue;

    const issues = [];
    const result = results[b.uid];
    if (!isActive(b)) {
      issues.push({
        text: `${b.status === "recusada" ? "Recusada" : "Cancelada"} no Cal.com, mas ativa no Nutrium`,
        fixes: [{ label: "Cancelar no Nutrium", action: "push" }],
      });
    } else if (b.synced && !a) {
      issues.push({
        text: "Já não existe no Nutrium (eliminada lá?)",
        fixes: [
          { label: "Cancelar no Cal.com", action: "cancel" },
          { label: "Recriar no Nutrium", action: "recreate" },
        ],
      });
    } else if (a?.status === N_CANCELLED) {
      issues.push({
        text: "Cancelada no Nutrium, mas ativa no Cal.com",
        fixes: [
          { label: "Cancelar no Cal.com", action: "cancel" },
          { label: "Repor no Nutrium", action: "push" },
        ],
      });
    } else if (a) {
      if (!sameTime(a.start, b.start)) {
        issues.push({
          text: `Hora diferente — Nutrium: ${when(a.start)} · Cal.com: ${when(b.start)}`,
          fixes: [
            { label: "Usar a hora do Nutrium", action: "reschedule", start: a.start },
            { label: "Usar a hora do Cal.com", action: "push" },
          ],
        });
      }
      if (a.status === N_CONFIRMED && b.status === "pendente") {
        issues.push({
          text: "Confirmada no Nutrium, ainda pendente no Cal.com",
          fixes: [{ label: "Confirmar no Cal.com", action: "confirm" }],
        });
      } else if (a.status === N_UNCONFIRMED && b.status === "confirmada") {
        issues.push({
          text: "Confirmada no Cal.com, por confirmar no Nutrium",
          fixes: [{ label: "Confirmar no Nutrium", action: "push" }],
        });
      }
    }

    entries.push({
      key: b.uid,
      start: b.start,
      end: b.end,
      nome: b.nome,
      consulta: b.consulta,
      local: b.local,
      motivo: b.motivo,
      cal: { uid: b.uid, status: b.status },
      nutrium: a ? { id: a.id, status: a.status, start: a.start } : null,
      state: result && !result.ok ? "erro" : issues.length ? "diferente" : a ? "ambos" : "so-cal",
      error: result && !result.ok ? result.error : null,
      issues,
    });
  }

  for (const a of appointments) {
    if (linked.has(a.id) || a.status === N_CANCELLED) continue;
    entries.push({
      key: `n${a.id}`,
      start: a.start,
      end: a.end,
      nome: a.nome,
      consulta: "",
      local: "",
      motivo: "",
      cal: null,
      nutrium: { id: a.id, status: a.status, start: a.start },
      state: "so-nutrium",
      error: null,
      issues: [],
    });
  }

  return entries.sort((x, y) => new Date(x.start) - new Date(y.start));
}

async function sync({ tabId } = {}) {
  const s = await settings();
  const startedAt = new Date().toISOString();
  const results = {};
  let agenda = [];
  let error = null;

  try {
    const { bookings } = await api(s, "/api/nutrium/marcacoes");
    tabId = await nutriumTab(tabId);

    for (const b of bookings) {
      const action = pendingAction(b, s.onCancel);
      if (!action) continue;
      try {
        await applyToNutrium(s, tabId, b, action);
        results[b.uid] = { ok: true, action };
      } catch (err) {
        results[b.uid] = { ok: false, action, error: err.message };
      }
    }

    const shareFrom = new Date(Date.now() - SHARE_PAST_DAYS * 86400000).toISOString();
    const shareTo = new Date(Date.now() + SHARE_FUTURE_DAYS * 86400000).toISOString();
    const appointments = await inNutrium(tabId, "listAppointments", shareFrom, shareTo);
    // O backoffice mostra a agenda do Nutrium junto com o Cal.com.
    await api(s, "/api/nutrium/agenda", {
      method: "POST",
      body: JSON.stringify({ from: shareFrom, to: shareTo, appointments }),
    });
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + AGENDA_DAYS * 86400000).getTime();
    agenda = buildAgenda(
      bookings,
      appointments.filter((a) => {
        const t = new Date(a.start).getTime();
        return t >= new Date(from).getTime() && t < to;
      }),
      results,
      from,
    );
  } catch (err) {
    error = err.message;
  }

  const attention = agenda.filter((e) => e.state === "diferente" || e.state === "erro").length;
  await chrome.storage.local.set({ lastSync: { startedAt, error, agenda } });
  await chrome.action.setBadgeText({ text: error || attention ? String(attention || "!") : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#A4473B" });
  return { error };
}

/** Correção escolhida na agenda para uma marcação do site. */
async function fix({ uid, action, start }) {
  const s = await settings();
  if (action === "confirm" || action === "cancel" || action === "reschedule") {
    await api(s, "/api/nutrium/marcacoes/acao", { method: "POST", body: JSON.stringify({ uid, action, start }) });
    return;
  }
  const { bookings } = await api(s, "/api/nutrium/marcacoes");
  const b = bookings.find((x) => x.uid === uid);
  if (!b) throw new Error("Marcação não encontrada no Cal.com.");
  const tabId = await nutriumTab();
  if (action === "recreate") {
    b.synced = null;
    await applyToNutrium(s, tabId, b, "create");
  } else {
    // "push": o Cal.com manda — repõe hora e estado no Nutrium.
    await applyToNutrium(s, tabId, b, isActive(b) ? "update" : s.onCancel);
  }
}

function syncOnce(options) {
  running ??= sync(options).finally(() => (running = null));
  return running;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "sync") {
    syncOnce().then(sendResponse);
    return true;
  }
  if (message.type === "fix") {
    fix(message)
      .then(() => null, (err) => err.message)
      .then(async (error) => {
        await running;
        await syncOnce();
        sendResponse({ error });
      });
    return true;
  }
  if (message.type === "open-agenda") {
    chrome.tabs.create({ url: chrome.runtime.getURL("agenda.html") });
  }
  if (message.type === "auto-sync" && sender.tab?.id) {
    chrome.storage.local.get("lastSync").then(({ lastSync }) => {
      const age = lastSync ? Date.now() - new Date(lastSync.startedAt).getTime() : Infinity;
      if (age > AUTO_SYNC_MINUTES * 60000) syncOnce({ tabId: sender.tab.id });
    });
  }
});
