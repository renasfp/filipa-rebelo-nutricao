import { STATES } from "./common.js";

const button = document.getElementById("sync");
const status = document.getElementById("status");
const counts = document.getElementById("counts");
const attention = document.getElementById("attention");

const dateFormat = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

async function render() {
  const { lastSync } = await chrome.storage.local.get("lastSync");
  const agenda = lastSync?.agenda ?? [];
  status.textContent = lastSync?.error
    ? `Erro: ${lastSync.error}`
    : lastSync
      ? `Última sincronização: ${new Date(lastSync.startedAt).toLocaleString("pt-PT")}`
      : "Ainda não sincronizou.";
  status.classList.toggle("error", !!lastSync?.error);

  counts.replaceChildren(
    ...["diferente", "so-cal", "so-nutrium", "ambos"].map((state) => {
      const n = agenda.filter((e) => e.state === state || (state === "diferente" && e.state === "erro")).length;
      const div = document.createElement("div");
      div.className = `count count-${state}`;
      div.innerHTML = `<b>${n}</b><span></span>`;
      div.lastElementChild.textContent = state === "diferente" ? "Com diferenças" : STATES[state].label;
      return div;
    }),
  );

  const urgent = agenda.filter((e) => e.state === "diferente" || e.state === "erro").slice(0, 4);
  attention.replaceChildren(
    ...urgent.map((e) => {
      const li = document.createElement("li");
      li.innerHTML = "<strong></strong><div class='muted'></div><div class='state'></div>";
      li.querySelector("strong").textContent = e.nome;
      li.querySelector(".muted").textContent = dateFormat.format(new Date(e.start));
      li.querySelector(".state").textContent = e.error ?? e.issues[0]?.text ?? "";
      return li;
    }),
  );
}

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "A sincronizar…";
  await chrome.runtime.sendMessage({ type: "sync" });
  button.disabled = false;
  button.textContent = "Sincronizar agora";
});

document.getElementById("agenda").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "open-agenda" });
  window.close();
});

chrome.storage.onChanged.addListener(render);
render();
