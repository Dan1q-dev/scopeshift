"use client";

import { useEffect, useRef, useState } from "react";
import { ChangeSummary } from "@/components/ui/ChangeSummary";
import { ghostButton, panel, primaryButton } from "@/components/ui/SiteHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import type { NegotiationTurn, PublicScenario } from "@/types/scope";

type Props = {
  scenario: PublicScenario;
  turns: NegotiationTurn[];
  currentEventId: string | null;
  completed: boolean;
  sending: boolean;
  pendingMessage: string | null;
  error: string | null;
  onSend: (message: string) => void;
  onRetry: () => void;
  onReplay: (turnIndex: number) => void;
};

const MAX_LENGTH = 2000;

function ClientBubble({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rise max-w-[85%]">
      <p className="m-0 mb-1 text-[11px] text-slate-500">{name} - client</p>
      <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2.5 text-sm leading-6">{children}</div>
    </div>
  );
}

export function ChatPanel({ scenario, turns, currentEventId, completed, sending, pendingMessage, error, onSend, onRetry, onReplay }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [turns.length, pendingMessage, error, currentEventId]);

  const visibleEvents = scenario.events.filter((event) => event.id === currentEventId || turns.some((turn) => turn.eventId === event.id));
  const trimmed = draft.trim();
  const canSend = !sending && !completed && !error && trimmed.length > 0 && trimmed.length <= MAX_LENGTH;
  const submit = () => { if (canSend) { onSend(trimmed); setDraft(""); } };

  return (
    <section aria-labelledby="chat-title" className={`${panel} flex min-h-[28rem] flex-col lg:min-h-0`}>
      <h2 id="chat-title" className="m-0 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Client conversation</h2>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {visibleEvents.map((event, eventNumber) => (
          <div key={event.id} className="space-y-3">
            <p className="m-0 text-center text-[11px] uppercase tracking-wider text-slate-600">Request {scenario.events.indexOf(event) + 1} of {scenario.events.length}: {event.title}</p>
            <ClientBubble name={scenario.clientName}>{event.clientMessage}</ClientBubble>
            {turns.map((turn, index) => turn.eventId !== event.id ? null : (
              <div key={turn.turnId} className="space-y-3">
                <div className="rise ml-auto max-w-[85%]">
                  <div className="rounded-2xl rounded-tr-sm bg-emerald-400/15 px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap">{turn.userMessage}</div>
                  <button type="button" disabled={sending} onClick={() => onReplay(index)} className="mt-1 ml-auto block cursor-pointer border-0 bg-transparent p-0 text-[11px] text-slate-500 underline underline-offset-2 hover:text-emerald-300 disabled:cursor-not-allowed">Replay from here</button>
                </div>
                <ClientBubble name={scenario.clientName}>
                  {turn.clientReply}
                  {turn.agreement && (
                    <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                      <div className="mb-1"><StatusChip status={turn.agreement.status} /></div>
                      <ChangeSummary change={turn.agreement.change} scenario={scenario} />
                      {turn.agreement.status === "counteroffered" && <p className="mt-1 mb-0 text-xs text-sky-200">This is an offer from the client. The contract is unchanged until you accept it or agree on other terms.</p>}
                      {turn.agreement.status === "rejected" && <p className="mt-1 mb-0 text-xs text-slate-400">Not agreed. The contract is unchanged.</p>}
                    </div>
                  )}
                </ClientBubble>
              </div>
            ))}
            {eventNumber === visibleEvents.length - 1 && event.id === currentEventId && !turns.some((turn) => turn.eventId === event.id) && !pendingMessage && (
              <p className="m-0 text-xs text-slate-500">Reply in your own words: ask a question, propose a price and date, trade scope, or decline.</p>
            )}
          </div>
        ))}
        {pendingMessage && <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-400/10 px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap opacity-70">{pendingMessage}</div>}
        {sending && <p className="m-0 text-sm text-slate-400" role="status">{scenario.clientName} is replying...</p>}
        {error && (
          <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm">
            <p className="m-0 text-rose-100">{error}</p>
            <button type="button" onClick={onRetry} className={`${ghostButton} mt-2`}>Send again</button>
          </div>
        )}
        {completed && <p className="m-0 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5 text-sm text-emerald-100">All client requests are resolved. Open the results to review the outcome or replay a decision.</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="border-t border-white/10 p-3">
        <label htmlFor="reply" className="sr-only">Your reply to the client</label>
        <textarea id="reply" rows={3} value={draft} maxLength={MAX_LENGTH} disabled={completed || sending || Boolean(error)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
          placeholder={completed ? "Scenario complete" : "Type your response..."}
          className="block w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-600 disabled:opacity-50" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-600">Enter to send, Shift+Enter for a new line</span>
          <button type="submit" disabled={!canSend} className={primaryButton}>{sending ? "Sending..." : "Send"}</button>
        </div>
      </form>
    </section>
  );
}
