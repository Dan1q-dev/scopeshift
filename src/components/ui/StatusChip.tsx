import type { Agreement } from "@/types/scope";

const styles: Record<Agreement["status"], { label: string; className: string }> = {
  accepted: { label: "Accepted", className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  proposed: { label: "Proposed - not agreed", className: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  counteroffered: { label: "Counteroffer", className: "border-sky-400/40 bg-sky-400/10 text-sky-200" },
  rejected: { label: "Rejected", className: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
};

export function StatusChip({ status }: { status: Agreement["status"] }) {
  const style = styles[status];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.className}`}>{style.label}</span>;
}
