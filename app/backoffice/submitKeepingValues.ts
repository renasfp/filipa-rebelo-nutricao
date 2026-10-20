"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Envia o formulário para a ação sem o React o limpar depois (comportamento por defeito de
 * <form action>), para não se perder o que foi escrito quando a resposta é um erro.
 */
export function submitKeepingValues(dispatch: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}
