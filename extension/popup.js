const button = document.getElementById("sync");
const status = document.getElementById("status");
const list = document.getElementById("list");
const only = document.getElementById("only");
const onlyTitle = document.getElementById("only-title");
const NUTRIUM_STATUS = ["confirmada", "não confirmada", "cancelada"];

const dateFormat = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function item(b, result, diff) {
  const li = document.createElement("li");
  const synced = b.synced && b.synced.version === b.version;
  const skipped = !b.synced && (b.status === "cancelada" || b.status === "recusada");
  const state =
    result && !result.ok ? "erro" : diff ? "diferente" : synced ? "ok" : skipped ? "ignorada" : "por sincronizar";
  li.className = `state-${state.replace(" ", "-")}`;
  li.innerHTML = `
    <div><strong></strong> <span class="chip"></span></div>
    <div class="muted"></div>
    <div class="state"></div>`;
  li.querySelector("strong").textContent = b.nome;
  li.querySelector(".chip").textContent = b.status;
  li.querySelector(".muted").textContent =
    `${dateFormat.format(new Date(b.start))} · ${b.consulta}${b.local ? ` · ${b.local}` : ""}`;
  li.querySelector(".state").textContent =
    state === "erro" ? `Erro: ${result.error}` : state === "diferente" ? `⚠ ${diff}` : state === "ok" ? "✓ No Nutrium" : state;
  return li;
}

function nutriumItem(a) {
  const li = document.createElement("li");
  li.innerHTML = `<div><strong></strong> <span class="chip"></span></div><div class="muted"></div>`;
  li.querySelector("strong").textContent = a.nome;
  li.querySelector(".chip").textContent = NUTRIUM_STATUS[a.status] ?? "";
  li.querySelector(".muted").textContent = dateFormat.format(new Date(a.start));
  return li;
}

async function render() {
  const { lastSync } = await chrome.storage.local.get("lastSync");
  list.replaceChildren();
  only.replaceChildren();
  if (!lastSync) {
    status.textContent = "Ainda não sincronizou.";
    return;
  }
  const when = new Date(lastSync.startedAt).toLocaleString("pt-PT");
  status.textContent = lastSync.error ? `Erro: ${lastSync.error}` : `Última sincronização: ${when}`;
  status.classList.toggle("error", !!lastSync.error);
  const upcoming = lastSync.bookings.filter((b) => new Date(b.end) > new Date());
  const diffs = lastSync.comparison?.diffs ?? {};
  for (const b of upcoming) list.append(item(b, lastSync.results[b.uid], diffs[b.uid]));
  if (!upcoming.length && !lastSync.error) list.innerHTML = `<li class="muted">Sem marcações futuras do site.</li>`;
  const nutriumOnly = (lastSync.comparison?.nutriumOnly ?? []).filter((a) => new Date(a.end) > new Date());
  onlyTitle.hidden = !nutriumOnly.length;
  for (const a of nutriumOnly) only.append(nutriumItem(a));
}

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "A sincronizar…";
  await chrome.runtime.sendMessage({ type: "sync" });
  button.disabled = false;
  button.textContent = "Sincronizar agora";
  render();
});

chrome.storage.onChanged.addListener(render);
render();
