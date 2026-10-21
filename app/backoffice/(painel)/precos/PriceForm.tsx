"use client";

import { useActionState } from "react";
import { submitKeepingValues } from "../../submitKeepingValues";
import { savePrice } from "../actions";

export default function PriceForm({ slug, current }: { slug: string; current: number | null }) {
  const [result, action, pending] = useActionState(savePrice, null);
  return (
    <form onSubmit={submitKeepingValues(action)} className="bo-inline-form">
      <input type="hidden" name="slug" value={slug} />
      <label className="bo-price-input">
        <input
          name="price"
          inputMode="decimal"
          defaultValue={current === null ? "" : (current / 100).toFixed(2).replace(".", ",")}
          placeholder="sem preço"
          aria-label="Preço em euros"
        />
        <span>€</span>
      </label>
      <button type="submit" className="bo-btn bo-btn-small" disabled={pending}>
        {pending ? "…" : "Guardar"}
      </button>
      {result === "ok" ? <span className="bo-ok">Guardado.</span> : result && <span className="bo-error">{result}</span>}
    </form>
  );
}
