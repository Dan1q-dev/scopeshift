import Link from "next/link";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
      <Link href="/" className="flex items-baseline gap-2 no-underline">
        <span className="text-lg font-semibold tracking-tight">Scope<span className="text-emerald-300">Shift</span></span>
        <span className="hidden text-[11px] uppercase tracking-[0.2em] text-slate-500 sm:inline">Project simulator</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">{children}</nav>
    </header>
  );
}

export const navLink = "rounded-md px-3 py-1.5 text-slate-300 no-underline hover:bg-white/5 hover:text-white";
export const primaryButton = "inline-flex items-center justify-center rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 no-underline transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";
export const ghostButton = "inline-flex items-center justify-center rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 no-underline transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
export const panel = "rounded-xl border border-white/10 bg-white/[0.03]";
