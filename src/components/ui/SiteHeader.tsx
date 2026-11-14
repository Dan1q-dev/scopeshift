import Link from "next/link";
import { ModeSwitch } from "@/components/ui/ModeSwitch";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/" className="flex items-baseline gap-2 no-underline">
          <span className="text-lg font-semibold tracking-tight">Scope<span className="text-emerald-300">Shift</span></span>
          <span className="hidden text-[11px] uppercase tracking-[0.2em] text-slate-500 xl:inline">Negotiation workspace</span>
        </Link>
        <nav aria-label="Modes"><ModeSwitch /></nav>
      </div>
      {children && <nav aria-label="Page" className="flex items-center gap-2 text-sm">{children}</nav>}
    </header>
  );
}

export const navLink = "rounded-md px-3 py-1.5 text-slate-300 no-underline hover:bg-white/5 hover:text-white";
export const primaryButton = "inline-flex items-center justify-center rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 no-underline transition duration-200 hover:bg-emerald-300 hover:shadow-[0_10px_28px_-12px_rgb(52_211_153/0.7)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
export const ghostButton = "inline-flex items-center justify-center rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 no-underline transition duration-200 hover:border-white/30 hover:bg-white/5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";
export const panel = "rounded-xl border border-white/10 bg-white/[0.03]";
