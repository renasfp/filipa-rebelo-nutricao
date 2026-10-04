import { requireAdmin } from "@/lib/auth";
import { listRequests } from "@/lib/booking/store";
import { formatDateLong, todayInLisbon } from "@/lib/booking/time";
import type { BookingRequest, BookingStatus } from "@/lib/booking/types";
import { updateRequestStatus } from "../actions";

const STATUS_LABELS: Record<BookingStatus, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  recusado: "Recusado",
};

function byAppointment(a: BookingRequest, b: BookingRequest) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function StatusButton({ id, status, label }: { id: string; status: BookingStatus; label: string }) {
  return (
    <form action={updateRequestStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`admin-btn admin-btn-${status}`}>
        {label}
      </button>
    </form>
  );
}

function RequestCard({ request }: { request: BookingRequest }) {
  const whatsapp = request.phone.replace(/\D/g, "");
  return (
    <article className="request-card">
      <div className="request-when">
        <strong>{formatDateLong(request.date)}</strong>
        <span>
          {request.time} · {request.locationName}
        </span>
      </div>
      <div className="request-who">
        <strong>{request.name}</strong>
        <a href={`mailto:${request.email}`}>{request.email}</a>
        <span>
          <a href={`tel:${request.phone}`}>{request.phone}</a>
          {" · "}
          <a
            href={`https://wa.me/${whatsapp.length === 9 ? `351${whatsapp}` : whatsapp}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </span>
        {request.notes && <p>{request.notes}</p>}
      </div>
      <div className="request-actions">
        <span className={`status status-${request.status}`}>{STATUS_LABELS[request.status]}</span>
        {request.status !== "confirmado" && (
          <StatusButton id={request.id} status="confirmado" label="Confirmar" />
        )}
        {request.status !== "recusado" && (
          <StatusButton id={request.id} status="recusado" label="Recusar" />
        )}
        {request.status !== "pendente" && (
          <StatusButton id={request.id} status="pendente" label="Repor pendente" />
        )}
      </div>
    </article>
  );
}

function RequestList({ title, requests, empty }: { title: string; requests: BookingRequest[]; empty: string }) {
  return (
    <section className="admin-section">
      <h2>
        {title} <span className="admin-count">{requests.length}</span>
      </h2>
      {requests.length ? (
        requests.map((r) => <RequestCard key={r.id} request={r} />)
      ) : (
        <p className="booking-muted">{empty}</p>
      )}
    </section>
  );
}

export default async function PedidosPage() {
  await requireAdmin();
  const requests = await listRequests();
  const today = todayInLisbon();
  const upcoming = requests.filter((r) => r.date >= today);

  return (
    <>
      <h1 className="admin-title">Pedidos de consulta</h1>
      <p className="booking-muted admin-hint">
        Os pedidos pendentes e confirmados bloqueiam o horário no site. Depois de confirmares, marca
        a consulta no Zappy ou no Nutrium.
      </p>
      <RequestList
        title="Por confirmar"
        requests={upcoming.filter((r) => r.status === "pendente").sort(byAppointment)}
        empty="Não há pedidos por confirmar."
      />
      <RequestList
        title="Próximas confirmadas"
        requests={upcoming.filter((r) => r.status === "confirmado").sort(byAppointment)}
        empty="Sem consultas confirmadas."
      />
      <RequestList
        title="Histórico"
        requests={requests.filter((r) => r.date < today || r.status === "recusado").slice(0, 50)}
        empty="Ainda sem histórico."
      />
    </>
  );
}
