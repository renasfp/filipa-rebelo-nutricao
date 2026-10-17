// Operações no Nutrium. Este ficheiro é injetado DENTRO da página do Nutrium (world "MAIN")
// pelo background, para usar a sessão da Filipa e a API interna do próprio Nutrium
// (os mesmos pedidos que a página faz; ver os HAR em .data/).
//
// window.__calNutrium.run(action, booking, synced, config) → { appointmentId, patientId }
// - action: "create" | "update" | "cancel" | "delete"
// - booking: marcação normalizada pelo site (ver lib/nutrium-sync.ts)
// - synced: { nutriumId, patientId } da última sincronização (em "update", "cancel" e "delete")
// - config: { workplaceId, professionalId, countryId }
//
// window.__calNutrium.listAppointments(from, to) → consultas da agenda nesse intervalo.
(() => {
  // scheduling_status_id no Nutrium.
  const STATUS = { confirmada: 0, pendente: 1, cancelada: 2, recusada: 2 };

  function csrfToken() {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    if (!token) throw new Error("Sessão do Nutrium não encontrada. Faz login no Nutrium e tenta de novo.");
    return token;
  }

  async function request(method, path, params, { accept = "application/json" } = {}) {
    const token = csrfToken();
    const body = params ? new URLSearchParams({ authenticity_token: token, ...params }) : undefined;
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: accept,
        "X-CSRF-Token": token,
        "X-Requested-With": "XMLHttpRequest",
        ...(body && { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }),
      },
      body,
    });
    if (res.status === 401 || res.redirected && /sign_in|login/.test(res.url)) {
      throw new Error("Sessão do Nutrium expirada. Faz login e tenta de novo.");
    }
    if (!res.ok) throw new Error(`Nutrium respondeu ${res.status} em ${method} ${path.split("?")[0]}`);
    return res;
  }

  async function findPatient(email) {
    const params = new URLSearchParams({
      "search[trigger_page]": "patients",
      "search[simplified]": "true",
      "search[patient_status_filter]": "all",
      "search[tag_filter]": "all",
      "search[workplace_filter]": "all",
      "search[query]": email,
      container: ".patients-index-results",
      partial: "patients/index/search/results",
    });
    const res = await request("GET", `/remote/partials/professionals/patients?${params}`, null, {
      accept: "text/javascript, application/javascript",
    });
    const ids = [...new Set([...(await res.text()).matchAll(/data-patient-id=\\?"(\d+)\\?"/g)].map((m) => m[1]))];
    if (ids.length > 1) throw new Error(`Há ${ids.length} clientes no Nutrium que correspondem a ${email}.`);
    return ids[0] ?? null;
  }

  async function createPatient(b, config) {
    // Formulário normal (não XHR): em caso de sucesso o Nutrium redireciona para a lista de clientes.
    const res = await fetch("/patients", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        authenticity_token: csrfToken(),
        "patient[name]": b.nome,
        "patient[workplace_id]": config.workplaceId,
        "patient[phone_number]": b.telefone,
        "patient[account][email]": b.email,
        "patient[country_of_residence_id]": config.countryId,
      }),
    });
    if (/sign_in|login/.test(res.url)) throw new Error("Sessão do Nutrium expirada. Faz login e tenta de novo.");
    // Se a validação falhar, o Nutrium volta a mostrar o formulário (sem criar o cliente).
    const id = res.ok ? await findPatient(b.email) : null;
    if (!id) throw new Error(`Não foi possível criar o cliente ${b.nome} no Nutrium (faltam dados obrigatórios?).`);
    if (b.nif) {
      await request("PATCH", `/remote/editables/professionals/patients/${id}`, {
        name: "vat_identifier",
        value: b.nif,
        pk: id,
      }, { accept: "*/*" });
    }
    return id;
  }

  function notes(b) {
    return [
      `Marcação pelo site (${b.consulta})`,
      b.local && `Local: ${b.local}`,
      b.motivo && `Motivo: ${b.motivo}`,
      `Ref. Cal.com: ${b.uid}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function appointmentParams(b, patientId, config, appointmentId = "") {
    return {
      "appointment[patient_id]": patientId,
      "appointment[videoconference][videoconference_source_id]": "-1",
      "appointment[begin_date]": new Date(b.start).toISOString(),
      "appointment[end_date]": new Date(b.end).toISOString(),
      "appointment[scheduling_status_id]": String(STATUS[b.status] ?? 1),
      "appointment[workplace_id]": config.workplaceId,
      "appointment[scheduling_notes]": notes(b),
      "appointment[professional_id]": config.professionalId,
      "appointment[id]": appointmentId,
      // O Cal.com já põe a marcação no Google Calendar; assim não fica duplicada.
      sync_with_google_calendar: "false",
      delete_payment_request: "true",
    };
  }

  async function run(action, b, synced, config) {
    if (action === "delete") {
      await request("PATCH", `/api/v0/appointments/${synced.nutriumId}/mark_as_deleted`);
      return { appointmentId: synced.nutriumId, patientId: synced.patientId };
    }
    if (action === "create") {
      const patientId = (await findPatient(b.email)) ?? (await createPatient(b, config));
      const res = await request("POST", "/api/v0/appointments/", appointmentParams(b, patientId, config));
      const { appointment } = await res.json();
      return { appointmentId: String(appointment.id), patientId };
    }
    // "update" e "cancel": o estado (incl. cancelada) vai em scheduling_status_id.
    await request("PUT", `/api/v0/appointments/${synced.nutriumId}/`, {
      _method: "patch",
      ...appointmentParams(b, synced.patientId, config, synced.nutriumId),
    });
    return { appointmentId: synced.nutriumId, patientId: synced.patientId };
  }

  async function listAppointments(from, to) {
    const params = new URLSearchParams({ start_date: from, end_date: to, include_birthdays: "false" });
    const res = await request("GET", `/api/v0/calendar_events/?${params}`);
    const { data } = await res.json();
    return data
      .filter((e) => e.object?.type === "appointments")
      .map(({ object: { id, attributes: a } }) => ({
        id: String(id),
        start: a.begin_date,
        end: a.end_date,
        nome: a.patient_name,
        status: a.scheduling_status_id,
        notas: a.scheduling_notes ?? "",
      }));
  }

  window.__calNutrium = { run, listAppointments };
})();
