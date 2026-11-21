"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CALLING_CODES, COUNTRIES } from "@/lib/catalog";
import { api, ApiError } from "@/lib/client";
import { createRegistrationSchema } from "@/lib/validators";
import { messages, type Locale, type Messages } from "@/i18n/messages";
import { Field } from "../field";

type FormValues = {
  esposo: { fullName: string; shirtSize: string; jacketSize: string; phoneCountry: string; phone: string; email: string };
  esposa: { fullName: string; shirtSize: string; jacketSize: string; phoneCountry: string; phone: string; email: string };
  city: string;
  region: string;
  country: string;
  privacyAccepted: boolean;
  questionnaireConsent: boolean;
  locale: Locale;
};

export function StartForm({ locale, shirtSizes, jacketSizes }: { locale: Locale; shirtSizes: string[]; jacketSizes: string[] }) {
  const copy = messages[locale];
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ code: string; accessKey: string; mail: string } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(createRegistrationSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      esposo: blankSpouse(),
      esposa: blankSpouse(),
      city: "",
      region: "",
      country: "Colombia",
      privacyAccepted: false,
      questionnaireConsent: false,
      locale,
    },
  });

  async function onConfirm() {
    setPending(true);
    setError("");
    try {
      const values = form.getValues();
      const result = await api<{ code: string; accessKey: string; email: { status: string }[] }>("/api/registro", {
        method: "POST",
        body: JSON.stringify(values),
      });
      const mailed = result.email.some((item) => item.status === "enviado");
      setCreated({ code: result.code, accessKey: result.accessKey, mail: mailed ? "sent" : "pending" });
      setOpen(false);
    } catch (caught) {
      setError(messageFor(caught, copy));
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <section className="rounded-3xl border border-[#C5E4F2] bg-white p-5 shadow-sm">
        <h1 className="text-3xl text-[#073B69]">{copy.accessTitle}</h1>
        <p className="mt-3 text-base text-[#1A4468]">{copy.accessBody}</p>
        <p className="mt-4 text-sm text-[#1A4468]">{copy.code}</p>
        <p className="font-mono text-2xl text-[#073B69]">{created.code}</p>
        <p className="mt-4 text-sm text-[#1A4468]">{copy.accessKey}</p>
        <p className="font-mono text-2xl text-[#073B69]">{created.accessKey}</p>
        <p className="mt-4 text-base" role="status">{created.mail === "sent" ? copy.mailSent : copy.mailPending}</p>
        <Button nativeButton={false} render={<Link href="/registro/panel" />} className="mt-6 h-12 px-5 text-base">{copy.continuePanel}</Button>
      </section>
    );
  }

  const values = form.watch();
  return (
    <form className="grid gap-6" onSubmit={form.handleSubmit(() => setOpen(true))} noValidate>
      <div>
        <h1 className="text-3xl text-[#073B69]">{copy.registerTitle}</h1>
        <p className="mt-2 text-base text-[#1A4468]">{copy.registerIntro}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SpouseCard title={copy.husband} prefix="esposo" form={form} copy={copy} shirtSizes={shirtSizes} jacketSizes={jacketSizes} />
        <SpouseCard title={copy.wife} prefix="esposa" form={form} copy={copy} shirtSizes={shirtSizes} jacketSizes={jacketSizes} />
      </div>
      <section className="grid gap-4 rounded-3xl border border-[#C5E4F2] bg-white p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-xl">{copy.shared}</h2>
        <Field label={copy.city} htmlFor="city" error={form.formState.errors.city ? copy.errors.validacion : undefined}>
          <Input id="city" className="h-12" autoComplete="address-level2" {...form.register("city")} />
        </Field>
        <Field label={copy.region} htmlFor="region" hint={copy.optional}>
          <Input id="region" className="h-12" {...form.register("region")} />
        </Field>
        <Field label={copy.country} htmlFor="country">
          <select id="country" className="h-12 w-full rounded-lg border border-[#B7D7E8] bg-white px-3" {...form.register("country")}>
            {COUNTRIES.map((country) => <option key={country}>{country}</option>)}
          </select>
        </Field>
      </section>
      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" className="mt-1 size-5" {...form.register("privacyAccepted")} />
        <span>{copy.privacyConsent} <Link className="underline" href="/privacidad">{copy.privacyLink}</Link></span>
      </label>
      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" className="mt-1 size-5" {...form.register("questionnaireConsent")} />
        <span>{copy.quizConsent}</span>
      </label>
      {error ? <p role="alert" className="text-[#9F1239]">{error}</p> : null}
      {form.formState.errors.privacyAccepted || form.formState.errors.questionnaireConsent ? <p role="alert" className="text-[#9F1239]">{copy.required}</p> : null}
      <Button type="submit" className="h-12 px-5 text-base">{copy.review}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.review}</DialogTitle>
            <DialogDescription>{values.esposo.fullName} · {values.esposa.fullName}</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1 text-sm text-[#1A4468]">
            <li>{values.city}, {values.country}</li>
            <li>{values.esposo.email} / {values.esposa.email}</li>
            <li>{copy.shirt}: {values.esposo.shirtSize} · {values.esposa.shirtSize}</li>
            <li>{copy.jacket}: {values.esposo.jacketSize} · {values.esposa.jacketSize}</li>
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{copy.backEdit}</Button>
            <Button type="button" disabled={pending} onClick={onConfirm}>{copy.confirmSave}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function blankSpouse() {
  return { fullName: "", shirtSize: "M", jacketSize: "M", phoneCountry: "+57", phone: "", email: "" };
}

function SpouseCard({
  title,
  prefix,
  form,
  copy,
  shirtSizes,
  jacketSizes,
}: {
  title: string;
  prefix: "esposo" | "esposa";
  form: ReturnType<typeof useForm<FormValues>>;
  copy: Messages;
  shirtSizes: string[];
  jacketSizes: string[];
}) {
  const error = form.formState.errors[prefix];
  return (
    <section className="grid gap-4 rounded-3xl border border-[#C5E4F2] bg-white p-4">
      <h2 className="text-xl">{title}</h2>
      <Field label={copy.fullName} htmlFor={`${prefix}-name`} error={error?.fullName ? copy.errors.validacion : undefined}>
        <Input id={`${prefix}-name`} className="h-12" autoComplete="name" {...form.register(`${prefix}.fullName`)} />
      </Field>
      <Field label={copy.shirt} htmlFor={`${prefix}-shirt`}>
        <select id={`${prefix}-shirt`} className="h-12 w-full rounded-lg border border-[#B7D7E8] bg-white px-3" {...form.register(`${prefix}.shirtSize`)}>
          {shirtSizes.map((size) => <option key={size}>{size}</option>)}
        </select>
      </Field>
      <Field label={copy.jacket} htmlFor={`${prefix}-jacket`}>
        <select id={`${prefix}-jacket`} className="h-12 w-full rounded-lg border border-[#B7D7E8] bg-white px-3" {...form.register(`${prefix}.jacketSize`)}>
          {jacketSizes.map((size) => <option key={size}>{size}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <Field label={copy.phoneCode} htmlFor={`${prefix}-code`}>
          <select id={`${prefix}-code`} className="h-12 w-full rounded-lg border border-[#B7D7E8] bg-white px-2" {...form.register(`${prefix}.phoneCountry`)}>
            {CALLING_CODES.map((code) => <option key={code}>{code}</option>)}
          </select>
        </Field>
        <Field label={copy.phone} htmlFor={`${prefix}-phone`} error={error?.phone ? copy.errors.validacion : undefined}>
          <Input id={`${prefix}-phone`} className="h-12" inputMode="tel" autoComplete="tel" {...form.register(`${prefix}.phone`)} />
        </Field>
      </div>
      <Field label={copy.email} htmlFor={`${prefix}-email`} error={error?.email ? copy.errors.distinto : undefined}>
        <Input id={`${prefix}-email`} className="h-12" type="email" autoComplete="email" {...form.register(`${prefix}.email`)} />
      </Field>
    </section>
  );
}

function messageFor(error: unknown, copy: Messages) {
  if (error instanceof ApiError) return copy.errors[error.code as keyof Messages["errors"]] ?? copy.errors.error;
  return copy.errors.error;
}
