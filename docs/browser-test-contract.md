# Browser acceptance for the active scenario

Use Node 22 and the real UI. Deterministic Playwright CI uses `SCOPESHIFT_AI_MODE=rules`, without accidentally inheriting local OpenAI. A fixture cannot prove live provider behavior. Keep browser/server origins consistent, including `127.0.0.1` versus `localhost`.

1. Start from the landing without registration. Original: $1,500 / 20h / day 7 / $75.00/h; core pages 12h, contact form 4h, gallery 4h.
2. Ask booking fields/reservation questions. Proposed name/email/slot still require confirmation; reservation mode and slot source remain unagreed. No contract mutation.
3. Explicitly exchange contact form and portfolio gallery for booking at unchanged fee/date. On client acceptance expect $1,500 / 18h / day 7 with both removals. Unnamed, unknown, reversed or alternative lists must not be partly applied.
4. Offer booking for $900 and two more days. The $400 counteroffer leaves the contract unchanged. Accept it to reach $1,900 / 26h / day 9.
5. Complete paid booking, +$150 two-day rush and gallery/testimonials swap. Expect $2,050 / 26h / day 7 / $78.85/h.
6. Replay booking for free, decline rush and make the same swap. Expect $1,500 / 26h / day 7 / $57.69/h while the original branch stays unchanged.
7. `I have to decline this request. Booking is not part of our contract.` must preserve the contract and advance. Ambiguous conditional statements must still request clarification.
8. Replay a later decision, retaining the booking prefix: restore $1,900 / 26h / day 9 before a new rush choice. Changed suffix IDs are new; exact prefix IDs are reused.
9. Lose a response after real server processing, then retry the identical request. Assert one amendment. Separately check live provider errors; network injection is not a provider availability test.
10. Results compares real attempts with Action, Rule and Verified evidence, readable labels and `No deliverables removed.`. Missing evidence is unassessed, not a zero skill score.
11. Reload and reopen attempts. Postgres history is private to signed identity and survives deployment replacement. Empty-cache restore needs separate evidence; clearing cookies loses anonymous access and is a different test.
12. Check mobile overflow, disabled navigation while sending, retained failed replies and usable retry. Select the repeated landing CTA unambiguously.

Release evidence names commit, runtime, browser, scenario/version and results. Public acceptance uses the production URL without Vercel login and real OpenAI; secrets and hidden client rules must stay out of client payloads. Published checks: `PUBLIC_DEPLOYMENT.md`; final combined-branch checks: `EVALUATOR_INTEGRATION_QA.md`.
