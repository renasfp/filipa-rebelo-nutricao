const form = document.getElementById("form");
const saved = document.getElementById("saved");

const DEFAULTS = {
  siteUrl: "https://filipa-rebelo-nutricao.vercel.app",
  token: "",
  onCancel: "cancel",
  workplaceId: "553322",
  professionalId: "533544",
  countryId: "183",
};

const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
for (const [name, value] of Object.entries({ ...DEFAULTS, ...stored })) form[name].value = value;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(Object.keys(DEFAULTS).map((name) => [name, form[name].value.trim()]));
  await chrome.storage.local.set(values);
  saved.textContent = "Guardado.";
});
