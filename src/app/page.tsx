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

const highlights = ["3 client requests", "Contract math after every reply", "Replay any decision"];

/**
 * Outcomes of the first client request in the first scenario (web-project-01), as documented in
 * docs/BACKEND_INTEGRATION.md. Update these if the scenario contract or its rules change.
 */
const outcomes = [
  { label: "Reply A", reply: "I can add it for free with no change to the deadline.", rate: "$57.69/h", delta: "-$17.31/h", terms: "$1,500 for 26 h", good: false },
  { label: "Reply B", reply: "I can add booking for an extra $400 and two more days.", rate: "$73.08/h", delta: "-$1.92/h", terms: "$1,900 for 26 h", good: true },
];

const eyebrow = "m-0 text-xs font-medium uppercase tracking-[0.22em] text-emerald-300";
const sectionTitle = "mt-3 mb-0 text-2xl font-semibold tracking-tight sm:text-3xl";

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader>
        <a href="#how" className={`${navLink} hidden sm:inline-block`}>How it works</a>
        <a href="#pricing" className={`${navLink} hidden sm:inline-block`}>Pricing</a>
        <Link href="/real-projects" className={navLink}>Real Project Mode</Link>
        <Link href="/simulation" className={primaryButton}>Start free simulation</Link>
      </SiteHeader>
      <main>
        <div className="hero-backdrop">
          <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24">
            <div className="rise">
              <p className={eyebrow}>Negotiation practice for freelancers</p>
              <h1 className="mt-4 mb-0 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">Stop working for free. <span className="text-emerald-300 sm:block">Learn to negotiate.</span></h1>
              <p className="mt-5 mb-0 max-w-xl text-lg leading-8 text-slate-300">ScopeShift is a project simulator where a client asks for more, you answer, and the contract shows exactly what your answer did to your income.</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                <Link href="/simulation" className={`${primaryButton} px-6 py-3 text-base shadow-[0_0_0_1px_rgb(110_231_183/0.25),0_12px_32px_-12px_rgb(52_211_153/0.55)]`}>Start free simulation</Link>
                <span className="text-sm text-slate-500">No sign-up. Takes about 10 minutes.</span>
              </div>
              <ul className="m-0 mt-8 flex list-none flex-wrap gap-2 p-0 text-xs text-slate-300">
                {highlights.map((item) => <li key={item} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">{item}</li>)}
              </ul>
            </div>

            <div className={`${panel} rise bg-[#0f171c]/80 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-6`} aria-label="Example from the first scenario">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-slate-500">Same request, two replies</p>
                <span className="tabular rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">Contract: $1,500 - 20 h - $75.00/h</span>
              </div>
              <p className="m-0 mt-4 mb-1 text-[11px] text-slate-500">Sarah Mitchell - client</p>
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2.5 text-sm leading-6">Could we add consultation booking? Visitors should choose a time and receive a confirmation email.</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {outcomes.map((outcome) => (
                  <div key={outcome.label} className={`flex flex-col rounded-xl border p-3 ${outcome.good ? "border-emerald-400/35 bg-emerald-400/[0.05]" : "border-white/10 bg-black/20"}`}>
                    <p className="m-0 text-[11px] font-medium uppercase tracking-wider text-slate-500">{outcome.label}</p>
                    <p className="mt-2 mb-0 flex-1 rounded-2xl rounded-tr-sm bg-emerald-400/15 px-3 py-2 text-sm leading-5">{outcome.reply}</p>
                    <p className="tabular mt-3 mb-0 text-2xl font-semibold tracking-tight">{outcome.rate}</p>
                    <p className={`tabular m-0 text-xs ${outcome.good ? "text-emerald-300" : "text-rose-300"}`}>{outcome.delta} vs contract</p>
                    <p className="tabular mt-1 mb-0 text-xs text-slate-500">{outcome.terms}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 mb-0 text-xs leading-5 text-slate-500">Results of the first request in the free scenario. The client accepted both replies. Only one of them was paid.</p>
            </div>
          </section>
        </div>

        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <p className={eyebrow}>The problem</p>
            <h2 className={sectionTitle}>Scope creep is a negotiation problem</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {problems.map((item) => (
                <div key={item.title} className={`${panel} lift reveal p-5`}>
                  <span className="block h-0.5 w-8 rounded-full bg-rose-300/70" aria-hidden="true" />
                  <h3 className="mt-4 mb-0 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 mb-0 text-sm leading-6 text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <p className={eyebrow}>The practice loop</p>
          <h2 className={sectionTitle}>How it works</h2>
          <ol className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className={`${panel} lift reveal p-5`}>
                <span className="tabular inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-sm font-semibold text-emerald-300">{index + 1}</span>
                <h3 className="mt-4 mb-0 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 mb-0 text-sm leading-6 text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="border-t border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <p className={eyebrow}>Plans</p>
            <h2 className={sectionTitle}>Pricing</h2>
            <p className="mt-2 mb-0 text-sm text-slate-500">Planned pricing. The first scenario is free and payments are not enabled in this demo.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className={`${panel} reveal flex flex-col border-emerald-400/40 bg-emerald-400/[0.04] p-5`}>
                <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-base font-semibold">First scenario</h3><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200">Available now</span></div>
                <p className="tabular mt-3 mb-0 text-3xl font-semibold">Free</p>
                <p className="mt-2 mb-5 flex-1 text-sm leading-6 text-slate-400">The full website project with replay and comparison.</p>
                <Link href="/simulation" className={primaryButton}>Start now</Link>
              </div>
              <div className={`${panel} lift reveal flex flex-col p-5`}>
                <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-base font-semibold">Membership</h3><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">Coming soon</span></div>
                <p className="tabular mt-3 mb-0 text-3xl font-semibold">$9<span className="text-base font-normal text-slate-400"> / month</span></p>
                <p className="mt-2 mb-0 flex-1 text-sm leading-6 text-slate-400">New client scenarios across freelance professions.</p>
              </div>
              <div className={`${panel} lift reveal flex flex-col p-5`}>
                <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-base font-semibold">Scenario pack</h3><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">Coming soon</span></div>
                <p className="tabular mt-3 mb-0 text-3xl font-semibold">$19<span className="text-base font-normal text-slate-400"> one-time</span></p>
                <p className="mt-2 mb-0 flex-1 text-sm leading-6 text-slate-400">A themed set of projects for one profession.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 sm:py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="m-0 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Your next client will ask for more.</h2>
              <p className="mt-2 mb-0 text-base text-slate-400">Practice the answer before it costs you a real project.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/simulation" className={`${primaryButton} px-6 py-3 text-base`}>Start free simulation</Link>
              <a href="#how" className={`${ghostButton} px-4 py-3`}>See how it works</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-slate-600">ScopeShift - Beyond Horizon - Business Cup 2.0. A learning simulation, not legal or financial advice.</footer>
    </div>
  );
}
