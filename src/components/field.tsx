import { Label } from "@/components/ui/label";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p id={`${htmlFor}-hint`} className="text-sm text-[#1A4468]">{hint}</p> : null}
      {error ? <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-[#9F1239]">{error}</p> : null}
    </div>
  );
}
