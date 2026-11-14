import Link from "next/link";

export default function Simulation() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-8 py-20">
      <Link href="/">ScopeShift</Link>
      <h1 className="text-4xl font-semibold">Simulation workspace</h1>
      <p className="max-w-2xl leading-7 text-slate-300">Frontend handoff: build the contract, conversation and project impact panels here. Fetch public scenarios from the API and use the shared TypeScript contracts.</p>
      <p className="text-slate-400">Negotiation is not connected yet. The API returns an explicit NOT_IMPLEMENTED error until the backend is ready.</p>
    </main>
  );
}
