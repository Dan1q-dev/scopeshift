import Link from "next/link";
import { ghostButton, navLink, panel, primaryButton, SiteHeader } from "@/components/ui/SiteHeader";

const steps = [
  { title: "Read the contract", text: "Start inside a fixed-fee project with a defined scope, price, and deadline." },
  { title: "Answer the client", text: "The client asks for changes. Reply in your own words: clarify, price it, trade scope, or decline." },
  { title: "See what it costs", text: "Only an accepted agreement changes the project. Fee, hours, deadline, and your effective hourly rate update from the result." },
  { title: "Replay the decision", text: "Go back to any reply, try a different approach, and compare the two outcomes side by side." },
];

const problems = [
  { title: "\"It's just a small change\"", text: "Extra requests arrive after the price is agreed. Each one looks minor. Together they turn a fair project into unpaid work." },
  { title: "Nobody teaches the conversation", text: "Contract templates and blog posts explain what to say. They do not let you practice saying it to a client who pushes back." },
  { title: "Mistakes are paid in real money", text: "Today the only place to practice is a live project, where a poor answer costs hours you never invoice." },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader>
        <a href="#how" className={`${navLink} hidden sm:inline-block`}>How it works</a>
        <a href="#pricing" className={`${navLink} hidden sm:inline-block`}>Pricing</a>
        <Link href="/simulation" className={primaryButton}>Start free simulation</Link>
      </SiteHeader>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="m-0 text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">Negotiation practice for freelancers</p>
            <h1 className="mt-4 mb-0 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Stop working for free. Learn to negotiate.</h1>
            <p className="mt-5 mb-0 max-w-xl text-lg leading-8 text-slate-300">ScopeShift is a project simulator where a client asks for more, you answer, and the contract shows exactly what your answer did to your income.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/simulation" className={`${primaryButton} px-6 py-3 text-base`}>Start free simulation</Link>
              <span className="text-sm text-slate-500">No sign-up. Takes about 10 minutes.</span>
            </div>
          </div>
          <div className={`${panel} p-5`} aria-label="Product preview, illustrative layout">
            <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-slate-500">Inside the simulator</p>
            <div className="mt-3 max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2.5 text-sm leading-6">Could we add one more feature? It should be a small change.</div>
            <div className="mt-3 ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-400/15 px-3.5 py-2.5 text-sm leading-6">Your reply decides what happens next.</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
              {["Total fee", "Est. hours", "Hourly rate"].map((label) => <div key={label} className="rounded-lg bg-black/25 px-2 py-3">{label}<div className="mt-1 text-base font-semibold text-slate-200">updates live</div></div>)}
            </div>
            <p className="mt-3 mb-0 text-xs text-slate-500">Illustration of the layout. Real figures come from the scenario you play.</p>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="m-0 text-2xl font-semibold tracking-tight">Scope creep is a negotiation problem</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {problems.map((item) => <div key={item.title} className={`${panel} p-5`}><h3 className="m-0 text-base font-semibold">{item.title}</h3><p className="mt-2 mb-0 text-sm leading-6 text-slate-400">{item.text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="m-0 text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="m-0 mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className={`${panel} p-5`}>
                <span className="tabular text-sm font-semibold text-emerald-300">0{index + 1}</span>
                <h3 className="mt-2 mb-0 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 mb-0 text-sm leading-6 text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="border-t border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="m-0 text-2xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-2 mb-0 text-sm text-slate-500">Planned pricing. The first scenario is free and payments are not enabled in this demo.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className={`${panel} border-emerald-400/30 p-5`}><h3 className="m-0 text-base font-semibold">First scenario</h3><p className="tabular mt-2 mb-0 text-3xl font-semibold">Free</p><p className="mt-2 mb-4 text-sm leading-6 text-slate-400">The full website project with replay and comparison.</p><Link href="/simulation" className={primaryButton}>Start now</Link></div>
              <div className={`${panel} p-5`}><h3 className="m-0 text-base font-semibold">Membership</h3><p className="tabular mt-2 mb-0 text-3xl font-semibold">$9<span className="text-base font-normal text-slate-400"> / month</span></p><p className="mt-2 mb-4 text-sm leading-6 text-slate-400">New client scenarios across freelance professions.</p><span className={`${ghostButton} cursor-default opacity-60`}>Coming soon</span></div>
              <div className={`${panel} p-5`}><h3 className="m-0 text-base font-semibold">Scenario pack</h3><p className="tabular mt-2 mb-0 text-3xl font-semibold">$19<span className="text-base font-normal text-slate-400"> one-time</span></p><p className="mt-2 mb-4 text-sm leading-6 text-slate-400">A themed set of projects for one profession.</p><span className={`${ghostButton} cursor-default opacity-60`}>Coming soon</span></div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-slate-600">ScopeShift - Beyond Horizon - Business Cup 2.0. A learning simulation, not legal or financial advice.</footer>
    </div>
  );
}
