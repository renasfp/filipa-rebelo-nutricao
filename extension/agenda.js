import { NUTRIUM_STATUS, STATES } from "./common.js";

const days = document.getElementById("days");
const filters = document.getElementById("filters");
const status = document.getElementById("status");
const banner = document.getElementById("banner");
const syncButton = document.getElementById("sync");
const rowTemplate = document.getElementById("row");

const FILTERS = [
  { id: "todas", label: "Todas", match: () => true },
  { id: "diferente", label: "Com diferenças", match: (e) => e.state === "diferente" || e.state === "erro" },
  { id: "so-cal", label: "Só no Cal.com", match: (e) => e.state === "so-cal" },
  { id: "so-nutrium", label: "Só no Nutrium", match: (e) => e.state === "so-nutrium" },
  { id: "ambos", label: "Em ambos", match: (e) => e.state === "ambos" },
];
let current = "todas";

const tz = { timeZone: "Europe/Lisbon" };
const time = new Intl.DateTimeFormat("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", tz);
const dayLabel = new Intl.DateTimeFormat("pt-PT", { ...tz, weekday: "long", day: "numeric", month: "long" });

function relativeDay(key) {
  const today = dayKey.format(new Date());
  const tomorrow = dayKey.format(new Date(Date.now() + 86400000));
  return key === today ? "Hoje" : key === tomorrow ? "Amanhã" : "";
}

function renderFilters(agenda) {
  filters.replaceChildren(
    ...FILTERS.map((f) => {
      const count = agenda.filter(f.match).length;
      const button = document.createElement("button");
      button.className = `filter filter-${f.id}${f.id === current ? " active" : ""}`;
      button.innerHTML = `<span></span> <b>${count}</b>`;
      button.firstElementChild.textContent = f.label;
      button.disabled = !count && f.id !== "todas";
      button.addEventListener("click", () => {
        current = f.id;
        render();
      });
      return button;
    }),
  );
}

function fixButton(entry, fix) {
  const button = document.createElement("button");
  button.className = "btn-small";
  button.textContent = fix.label;
  button.addEventListener("click", async () => {
    const all = [...document.querySelectorAll("button")];
    all.forEach((b) => (b.disabled = true));
    button.textContent = "A aplicar…";
    const { error } = await chrome.runtime.sendMessage({ type: "fix", uid: entry.cal.uid, ...fix });
    if (error) showBanner(`Não foi possível: ${error}`);
    all.forEach((b) => (b.disabled = false));
  });
  return button;
}

function row(entry) {
  const el = rowTemplate.content.firstElementChild.cloneNode(true);
  const meta = STATES[entry.state];
  el.classList.add(`entry-${entry.state}`);
  el.querySelector(".start").textContent = time.format(new Date(entry.start));
  el.querySelector(".end").textContent = time.format(new Date(entry.end));
  el.querySelector(".name").textContent = entry.nome;
  el.querySelector(".state-label").textContent = meta.label;
  el.querySelector(".details").textContent = [entry.consulta, entry.local, entry.motivo && `“${entry.motivo}”`]
    .filter(Boolean)
    .join(" · ");

  const cal = el.querySelector(".source.cal");
  cal.textContent = entry.cal ? `Cal.com · ${entry.cal.status}` : "Cal.com · —";
  cal.classList.toggle("missing", !entry.cal);
  const nutrium = el.querySelector(".source.nutrium");
  nutrium.textContent = entry.nutrium ? `Nutrium · ${NUTRIUM_STATUS[entry.nutrium.status]}` : "Nutrium · —";
  nutrium.classList.toggle("missing", !entry.nutrium);

  const issues = el.querySelector(".issues");
  if (entry.error) {
    const p = document.createElement("p");
    p.className = "issue";
    p.textContent = entry.error;
    issues.append(p);
  }
  for (const issue of entry.issues) {
    const p = document.createElement("div");
    p.className = "issue";
    p.append(issue.text);
    const actions = document.createElement("div");
    actions.className = "issue-actions";
    actions.append(...issue.fixes.map((f) => fixButton(entry, f)));
    p.append(actions);
    issues.append(p);
  }
  if (entry.state === "so-cal" && !entry.error) {
    const p = document.createElement("p");
    p.className = "muted small";
    p.textContent = "Será criada no Nutrium na próxima sincronização.";
    issues.append(p);
  }
  return el;
}

function showBanner(text) {
  banner.textContent = text;
  banner.hidden = !text;
}

async function render() {
  const { lastSync } = await chrome.storage.local.get("lastSync");
  const agenda = lastSync?.agenda ?? [];
  status.textContent = lastSync
    ? `Última sincronização: ${new Date(lastSync.startedAt).toLocaleString("pt-PT")}`
    : "Ainda não sincronizou.";
  showBanner(lastSync?.error ?? "");
  renderFilters(agenda);

  const visible = agenda.filter(FILTERS.find((f) => f.id === current).match);
  if (!visible.length) {
    days.innerHTML = `<p class="empty muted">${lastSync ? "Sem consultas para mostrar." : "Carrega em Sincronizar com o Nutrium aberto noutra aba."}</p>`;
    return;
  }
  const groups = Map.groupBy(visible, (e) => dayKey.format(new Date(e.start)));
  days.replaceChildren(
    ...[...groups].map(([key, entries]) => {
      const section = document.createElement("section");
      section.className = "day";
      const h2 = document.createElement("h2");
      const rel = relativeDay(key);
      const label = dayLabel.format(new Date(entries[0].start));
      h2.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      if (rel) h2.insertAdjacentHTML("afterbegin", `<span class="today">${rel}</span> `);
      section.append(h2, ...entries.map(row));
      return section;
    }),
  );
}

syncButton.addEventListener("click", async () => {
  syncButton.disabled = true;
  syncButton.textContent = "A sincronizar…";
  await chrome.runtime.sendMessage({ type: "sync" });
  syncButton.disabled = false;
  syncButton.textContent = "Sincronizar";
});

chrome.storage.onChanged.addListener(render);
render();
