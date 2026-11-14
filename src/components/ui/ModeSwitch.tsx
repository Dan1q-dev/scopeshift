"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modes = [
  { href: "/simulation", label: "Practice", name: "Practice Mode", match: (path: string) => path.startsWith("/simulation") || path.startsWith("/results") },
  { href: "/real-projects", label: "Real Project", name: "Real Project Mode", match: (path: string) => path.startsWith("/real-projects") },
];

/** Switches between the fictional Practice simulator and Real Project Mode. No project data moves between them. */
export function ModeSwitch() {
  const path = usePathname() ?? "/";
  return (
    <div role="group" aria-label="Mode" className="mode-switch relative flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-xs sm:text-sm">
      {modes.map((mode) => {
        const active = mode.match(path);
        return (
          <Link key={mode.href} href={mode.href} aria-label={mode.name} aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1 no-underline transition duration-200 ${active ? "bg-emerald-400/15 text-emerald-100 shadow-[inset_0_0_0_1px_rgb(110_231_183/0.35)]" : "text-slate-400 hover:text-white"}`}>
            {mode.label}
          </Link>
        );
      })}
    </div>
  );
}
