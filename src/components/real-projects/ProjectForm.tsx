"use client";

import { useState, type FormEvent } from "react";
import { REAL_PROJECT_LIMITS, type RealProject, type RealProjectCreateInput } from "@/types/real-project";
import { cardClass, checkboxClass, fieldClass, primaryClass, secondaryClass, Spinner } from "./ui";

const sampleAgreement = "Develop a responsive five-page business website with a contact form. The form includes name, email, message, and an email notification. Appointment scheduling, payment processing, and calendar integration are excluded. Agreed fee: $1,500. Estimated effort: 20 hours.";
const sampleAmendment = "Approved amendment: replace the portfolio gallery with a testimonials page at the same price and delivery date.";

function validate(values: { fee: string; hours: string; deadline: string }) {
  const errors: Partial<Record<"fee" | "hours" | "deadline", string>> = {};
  const fee = Number(values.fee);
  if (values.fee.trim() && (!Number.isFinite(fee) || fee < 0 || Math.abs(fee * 100 - Math.round(fee * 100)) >= 0.000001)) errors.fee = "Enter a fee of $0 or more with at most two decimal places.";
  const hours = Number(values.hours);
  if (values.hours.trim() && (!Number.isFinite(hours) || hours <= 0 || Math.abs(hours * 100 - Math.round(hours * 100)) >= 0.000001)) errors.hours = "Enter more than 0 hours with at most two decimal places.";
  if (values.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(values.deadline)) errors.deadline = "Use a calendar date.";
  return errors;
}

export function ProjectForm({ project, disabled, busy, onSave, onCancel }: {
  project: RealProject | null;
  disabled: boolean;
  busy: boolean;
  onSave: (input: RealProjectCreateInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [fee, setFee] = useState(project ? String(project.originalFeeCents / 100) : "");
  const [hours, setHours] = useState(project ? String(project.originalEstimatedHours) : "");
  const [deadline, setDeadline] = useState(project?.originalDeadline ?? "");
  const [agreement, setAgreement] = useState(project?.documents.find((document) => document.kind === "agreement")?.canonicalText ?? "");
  const [amendments, setAmendments] = useState(project?.documents.find((document) => document.kind === "amendment")?.canonicalText ?? "");
  const [saveConsent, setSaveConsent] = useState(false);
  const errors = validate({ fee, hours, deadline });
  const hasErrors = Object.keys(errors).length > 0;

  function sample() {
    const delivery = new Date();
    delivery.setUTCDate(delivery.getUTCDate() + 14);
    setName("Fictional studio website"); setFee("1500"); setHours("20"); setDeadline(delivery.toISOString().slice(0, 10));
    setAgreement(sampleAgreement); setAmendments(sampleAmendment); setSaveConsent(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (hasErrors) return;
    onSave({ name, originalFeeCents: Math.round(Number(fee) * 100), originalEstimatedHours: Number(hours), originalDeadline: deadline, agreementText: agreement, amendmentsText: amendments });
  }
  const error = (key: keyof typeof errors) => errors[key] && <span id={`project-${key}-error`} className="mt-1 block text-xs text-rose-200">{errors[key]}</span>;

  return (
    <section className={`${cardClass} section-enter p-5 sm:p-6`} aria-labelledby="project-form-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-widest text-emerald-300">{project ? "Source revision" : "Establish your baseline"}</p>
          <h2 id="project-form-title" className="m-0 mt-1 text-xl font-semibold tracking-tight">{project ? "Edit the agreement snapshot" : "Bring a real project"}</h2>
        </div>
        {!project && <button type="button" className={secondaryClass} disabled={disabled} onClick={sample}>Use fictional sample</button>}
      </div>
      <p className="mt-3 mb-0 max-w-3xl text-sm leading-6 text-slate-400">
        Paste the agreed scope and any approved amendments. Remove client names, contact details, credentials, and confidential information before saving. PDF, DOCX, and image uploads are not available in this version.
        {!project && <span className="block text-xs text-slate-500">The fictional sample fills editable fields only. Nothing is saved or sent to AI.</span>}
      </p>

      <form onSubmit={submit} className="mt-5" noValidate={false}>
        <fieldset disabled={disabled} className="m-0 space-y-5 border-0 p-0">
          <label className="block text-sm font-medium text-slate-200">Project name
            <input className={fieldClass} maxLength={160} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Use a non-confidential project name" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="block text-sm font-medium text-slate-200">Agreed fee (USD)
              <input className={fieldClass} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={fee} aria-invalid={Boolean(errors.fee)} aria-describedby={errors.fee ? "project-fee-error" : undefined} onChange={(event) => setFee(event.target.value)} placeholder="1500" />
            </label>{error("fee")}</div>
            <div><label className="block text-sm font-medium text-slate-200">Original estimated hours
              <input className={fieldClass} type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" required value={hours} aria-invalid={Boolean(errors.hours)} aria-describedby={errors.hours ? "project-hours-error" : undefined} onChange={(event) => setHours(event.target.value)} placeholder="20" />
            </label>{error("hours")}</div>
            <div><label className="block text-sm font-medium text-slate-200">Agreed delivery date
              <input className={fieldClass} type="date" required value={deadline} aria-invalid={Boolean(errors.deadline)} onChange={(event) => setDeadline(event.target.value)} />
            </label>{error("deadline")}</div>
          </div>
          <label className="block text-sm font-medium text-slate-200">Agreement / statement of work
            <textarea className={`${fieldClass} min-h-44 font-normal leading-6`} required maxLength={REAL_PROJECT_LIMITS.agreementCharacters} value={agreement} onChange={(event) => setAgreement(event.target.value)} placeholder="Paste the source text, then redact anything sensitive." />
          </label>
          <p className="m-0 -mt-3 flex justify-between text-xs text-slate-500"><span>Plain text only.</span><span className="tabular">{agreement.length.toLocaleString()} / {REAL_PROJECT_LIMITS.agreementCharacters.toLocaleString()} characters</span></p>
          <label className="block text-sm font-medium text-slate-200">Approved amendments (optional)
            <textarea className={`${fieldClass} min-h-24 font-normal leading-6`} maxLength={REAL_PROJECT_LIMITS.amendmentsCharacters} value={amendments} onChange={(event) => setAmendments(event.target.value)} placeholder="Include only changes already agreed with the client." />
          </label>

          <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.05] p-4 text-sm leading-6 text-slate-300">
            <p className="m-0 font-medium text-sky-100">Where this text goes</p>
            <p className="m-0 mt-1">Saving stores this text and your project history on our server, linked to this browser&apos;s anonymous session. Clearing the browser cookie can remove your access; it does not delete server data. Editing or redacting a source creates a new revision and retains earlier snapshots in history. Use Delete project to remove this project and all its associated history from our application.</p>
            <p className="m-0 mt-2">Analysis and draft generation send the relevant pasted text to OpenAI only when you explicitly authorize those actions. Review and redact your sources first.</p>
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" className={checkboxClass} checked={saveConsent} onChange={(event) => setSaveConsent(event.target.checked)} />
            <span>I have reviewed this text and agree to save it and the project history on the server for this browser session.</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={primaryClass} disabled={!saveConsent || hasErrors}>{busy && <Spinner />}{project ? "Save new source revision" : "Save project"}</button>
            {onCancel && <button type="button" className={secondaryClass} onClick={onCancel}>Cancel</button>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
