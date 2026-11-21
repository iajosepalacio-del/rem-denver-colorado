"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client";
import type { CoupleView } from "@/lib/types";
import { messages, type Locale, type Messages } from "@/i18n/messages";

type Question = { id: string; position: number; prompt: string; help: string; required: boolean };

export function SemaforoFlow({ locale }: { locale: Locale }) {
  const copy = messages[locale];
  const params = useSearchParams();
  const role = params.get("quien") === "esposa" ? "esposa" : "esposo";
  const [view, setView] = useState<CoupleView | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CoupleView>("/api/registro").then(async (next) => {
      setView(next);
      const data = await api<{ questions: Question[]; hasKey: boolean }>(`/api/semaforo?participantId=${next.spouses[role].id}`);
      setQuestions(data.questions);
      setHasKey(data.hasKey);
    }).catch((caught) => setError(caught instanceof ApiError ? copy.errors[caught.code as keyof Messages["errors"]] ?? copy.errors.error : copy.errors.error));
  }, [role, copy]);

  if (!view) return <p>{error || copy.loading}</p>;
  const spouse = view.spouses[role];
  const group = Math.max(1, view.semaforo.groupSize);
  const slice = questions.slice(index, index + group);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (!hasKey) {
        await api("/api/semaforo", { method: "POST", body: JSON.stringify({ kind: "clave", participantId: spouse.id, answerKey: key }) });
        setHasKey(true);
      } else {
        const data = await api<{ answers: { questionId?: string; prompt: string; answer: string }[] }>("/api/semaforo", {
          method: "POST",
          body: JSON.stringify({ kind: "ver", participantId: spouse.id, answerKey: key }),
        });
        const next: Record<string, string> = {};
        for (const answer of data.answers) {
          const question = questions.find((item) => item.prompt === answer.prompt);
          if (question) next[question.id] = answer.answer;
        }
        setAnswers(next);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? copy.errors[caught.code as keyof Messages["errors"]] ?? copy.errors.error : copy.errors.error);
    }
  }

  async function save(submit: boolean) {
    setError("");
    const payload = Object.entries(answers).filter(([, value]) => value.trim()).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      await api("/api/semaforo", {
        method: "POST",
        body: JSON.stringify({ participantId: spouse.id, answerKey: key, answers: payload, submit }),
      });
      if (submit) setDone(true);
      else setIndex((value) => Math.min(questions.length, value + group));
    } catch (caught) {
      setError(caught instanceof ApiError ? copy.errors[caught.code as keyof Messages["errors"]] ?? copy.errors.error : copy.errors.error);
    }
  }

  if (!view.semaforo.questionsLoaded) return <p>{copy.semaforoMissing}</p>;
  if (done) {
    return (
      <section className="rounded-3xl bg-white p-5">
        <h1 className="text-3xl">{copy.semaforoTitle}</h1>
        <p className="mt-3">{copy.status.enviado}. {copy.semaforoPrivate}</p>
        <Link className="mt-4 inline-block underline" href="/registro/panel">{copy.continuePanel}</Link>
      </section>
    );
  }
  if (!hasKey || (hasKey && key.length < 8 && Object.keys(answers).length === 0)) {
    return (
      <form className="grid max-w-lg gap-3 rounded-3xl bg-white p-5" onSubmit={unlock}>
        <h1 className="text-3xl">{role === "esposo" ? copy.husband : copy.wife}</h1>
        <p className="text-sm text-[#1A4468]">{copy.semaforoPrivate}</p>
        <label className="grid gap-1">{copy.accessKey}<Input className="h-12" value={key} onChange={(event) => setKey(event.target.value)} minLength={8} required /></label>
        {error ? <p role="alert" className="text-[#9F1239]">{error}</p> : null}
        <Button type="submit" className="h-12">{hasKey ? copy.enter : copy.save}</Button>
      </form>
    );
  }

  return (
    <section className="grid gap-4 rounded-3xl bg-white p-5">
      <p className="text-sm">{copy.progress}: {Math.min(questions.length, index + slice.length)} / {questions.length}</p>
      {slice.map((question) => (
        <label key={question.id} className="grid gap-2">
          <span className="text-lg">{question.position}. {question.prompt}</span>
          {question.help ? <span className="text-sm text-[#1A4468]">{question.help}</span> : null}
          <Textarea value={answers[question.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} required={question.required} />
        </label>
      ))}
      {error ? <p role="alert" className="text-[#9F1239]">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - group))}>{copy.back}</Button>
        {index + group < questions.length ? (
          <Button type="button" className="h-12" onClick={() => save(false)}>{copy.saveNext}</Button>
        ) : (
          <Button type="button" className="h-12" onClick={() => save(true)}>{copy.confirmSave}</Button>
        )}
      </div>
    </section>
  );
}
