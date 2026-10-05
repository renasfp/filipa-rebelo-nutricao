"use client";

import { useState } from "react";

const LONG_QUOTE_CHARS = 400;

export default function TestimonialQuote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_QUOTE_CHARS;

  return (
    <>
      <blockquote className={isLong && !expanded ? "clamped" : undefined}>&quot;{text}&quot;</blockquote>
      {isLong && (
        <button type="button" className="testimonial-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Ler menos" : "Ler mais"}
        </button>
      )}
    </>
  );
}
