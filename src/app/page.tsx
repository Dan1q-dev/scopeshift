import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-8 py-16">
      <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Beyond Horizon / Business Cup 2.0</p>
      <h1 className="text-6xl font-semibold tracking-tight">ScopeShift</h1>
      <p className="max-w-xl text-2xl text-slate-300">Stop working for free. Learn to negotiate.</p>
      <p className="max-w-xl leading-7 text-slate-400">Development foundation. The shared contracts and scenario API are ready for the team. The negotiation engine and product interface are being built.</p>
      <div><Link href="/simulation">Open development workspace</Link></div>
    </main>
  );
}
