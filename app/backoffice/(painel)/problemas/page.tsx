import Link from "next/link";
import { findProblems, type Problem } from "@/lib/backoffice/agenda";
import { verifySession } from "@/lib/backoffice/session";

const SEVERITY: Record<Problem["severity"], [string, string]> = {
  alta: ["Urgente", "bo-chip-alta"],
  media: ["Rever", "bo-chip-media"],
  info: ["Informação", "bo-chip-info"],
};

export default async function ProblemsPage() {
  const user = await verifySession();
  let problems: Problem[] = [];
  let error = false;
  try {
    problems = await findProblems(user.role === "admin");
  } catch (err) {
    console.error("[backoffice/problemas]", err);
    error = true;
  }

  return (
    <>
      <h1>Problemas</h1>
      <p className="bo-muted">O que precisa de atenção, do mais urgente para o menos urgente.</p>
      {error && <p className="bo-error">Não foi possível verificar tudo (Cal.com indisponível?).</p>}
      {!error && !problems.length && <p className="bo-empty">Está tudo em ordem. 🎉</p>}
      <div style={{ marginTop: "1rem" }}>
        {problems.map((p, i) => (
          <article key={i} className={`bo-card bo-problem bo-problem-${p.severity}`}>
            <div className="bo-chips" style={{ marginTop: 0 }}>
              <span className={`bo-chip ${SEVERITY[p.severity][1]}`}>{SEVERITY[p.severity][0]}</span>
            </div>
            <strong>{p.title}</strong>
            <p className="bo-muted bo-small">{p.detail}</p>
            {p.uid && p.title.startsWith("Por confirmar") && (
              <Link className="bo-small" href="/backoffice?ver=pendentes">
                Abrir na agenda →
              </Link>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
