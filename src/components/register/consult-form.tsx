"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { accessSchema } from "@/lib/validators";
import { messages, type Locale, type Messages } from "@/i18n/messages";
import { Field } from "../field";

export function ConsultForm({ locale }: { locale: Locale }) {
  const copy = messages[locale];
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(accessSchema),
    defaultValues: { code: "", email: "", accessKey: "" },
  });

  return (
    <form
      className="grid max-w-xl gap-4 rounded-3xl border border-[#C5E4F2] bg-white p-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError("");
        try {
          await api("/api/acceso", { method: "POST", body: JSON.stringify(values) });
          router.push("/registro/panel");
          router.refresh();
        } catch (caught) {
          setError(caught instanceof ApiError ? copy.errors[caught.code as keyof Messages["errors"]] ?? copy.errors.no_autorizado : copy.errors.error);
        }
      })}
    >
      <h1 className="text-3xl">{copy.consultTitle}</h1>
      <p className="text-[#1A4468]">{copy.consultHelp}</p>
      <Field label={copy.code} htmlFor="code" error={form.formState.errors.code ? copy.errors.validacion : undefined}>
        <Input id="code" className="h-12" autoComplete="off" {...form.register("code")} />
      </Field>
      <Field label={copy.email} htmlFor="email" error={form.formState.errors.email ? copy.errors.validacion : undefined}>
        <Input id="email" type="email" className="h-12" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label={copy.accessKey} htmlFor="accessKey">
        <Input id="accessKey" className="h-12" autoComplete="off" {...form.register("accessKey")} />
      </Field>
      {error ? <p role="alert" className="text-[#9F1239]">{error}</p> : null}
      <Button type="submit" className="h-12 text-base" disabled={form.formState.isSubmitting}>{copy.enter}</Button>
    </form>
  );
}
