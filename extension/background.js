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
const COMPARE_DAYS = 90;
const NUTRIUM_TABS = "https://*.nutrium.com/*";

let running = null;

async function settings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const s = { ...DEFAULTS, ...stored };
  return { ...s, siteUrl: s.siteUrl.replace(/\/$/, "") };
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

/** O que falta fazer no Nutrium para esta marcação (ou null se já está em dia). */
function pendingAction(b, onCancel) {
  const cancelled = b.status === "cancelada" || b.status === "recusada";
  if (!b.synced) return cancelled ? null : "create";
  if (b.synced.version === b.version) return null;
  return cancelled ? onCancel : "update";
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

/** Compara a agenda do Nutrium com as marcações do site. */
async function compare(tabId, bookings) {
  const from = new Date(Date.now() - 86400000).toISOString();
  const to = new Date(Date.now() + COMPARE_DAYS * 86400000).toISOString();
  const appointments = await inNutrium(tabId, "listAppointments", from, to);
  const byId = new Map(appointments.map((a) => [a.id, a]));
  const fromSite = new Set(bookings.map((b) => b.synced?.nutriumId).filter(Boolean));

  const nutriumOnly = appointments.filter((a) => !fromSite.has(a.id) && a.status !== 2);
  const diffs = {};
  for (const b of bookings) {
    const active = b.status === "pendente" || b.status === "confirmada";
    if (!b.synced || !active || new Date(b.start) < new Date(from)) continue;
    const a = byId.get(b.synced.nutriumId);
    if (!a) diffs[b.uid] = "Já não existe no Nutrium (eliminada lá?)";
    else if (a.status === 2) diffs[b.uid] = "Cancelada no Nutrium, mas ativa no Cal.com";
    else if (new Date(a.start).getTime() !== new Date(b.start).getTime()) {
      diffs[b.uid] = `No Nutrium está marcada para ${new Date(a.start).toLocaleString("pt-PT")}`;
    }
  }
  return { nutriumOnly, diffs };
}

async function sync({ tabId } = {}) {
  const s = await settings();
  const config = { workplaceId: s.workplaceId, professionalId: s.professionalId, countryId: s.countryId };
  const startedAt = new Date().toISOString();
  const results = {};
  let bookings = [];
  let comparison = null;
  let error = null;

  try {
    bookings = (await api(s, "/api/nutrium/marcacoes")).bookings;
    tabId ??= (await chrome.tabs.query({ url: NUTRIUM_TABS }))[0]?.id;
    if (!tabId) throw new Error("Abre o Nutrium numa aba e tenta de novo.");

    for (const b of bookings) {
      const action = pendingAction(b, s.onCancel);
      if (!action) continue;
      try {
        const { appointmentId, patientId } = await inNutrium(tabId, "run", action, b, b.synced, config);
        await api(s, "/api/nutrium/marcacoes", {
          method: "POST",
          body: JSON.stringify({ uid: b.uid, nutriumId: appointmentId, patientId, version: b.version }),
        });
        b.synced = { nutriumId: appointmentId, patientId, version: b.version, syncedAt: new Date().toISOString() };
        results[b.uid] = { ok: true, action };
      } catch (err) {
        results[b.uid] = { ok: false, action, error: err.message };
      }
    }
    comparison = await compare(tabId, bookings);
  } catch (err) {
    error = err.message;
  }

  const failed = Object.values(results).filter((r) => !r.ok).length;
  const left = bookings.filter((b) => pendingAction(b, s.onCancel)).length;
  const attention = failed + Object.keys(comparison?.diffs ?? {}).length;
  await chrome.storage.local.set({ lastSync: { startedAt, error, bookings, results, comparison } });
  await chrome.action.setBadgeText({ text: error || attention ? "!" : left ? String(left) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: error || attention ? "#A4473B" : "#5E7A5B" });
  return { error, results };
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
  if (message.type === "auto-sync" && sender.tab?.id) {
    chrome.storage.local.get("lastSync").then(({ lastSync }) => {
      const age = lastSync ? Date.now() - new Date(lastSync.startedAt).getTime() : Infinity;
      if (age > AUTO_SYNC_MINUTES * 60000) syncOnce({ tabId: sender.tab.id });
    });
  }
});
