# Coaching and draft recovery: acceptance plan

Prepared and executed in part on 15 November 2026 by Albina. **Status: core published walkthrough passed; extended failure/boundary matrix remains incomplete.** Implementation from `codex/coaching-and-draft-recovery` is now in main `84f93d46f2aead839c12dd66e095d3b7899d5e1d`. No implementation files were changed in this acceptance task. See the execution record below for actual results and limits. No learning-efficacy claim is made.

## Scope and test record

Three release requirements:

1. Results identifies an actual learner reply and actionable advice. Improve this reply starts a separate Replay attempt immediately before that turn. The original is preserved; the learner writes the replacement.
2. Unsaved draft edits survive switching draft tabs. Switching does not save to the server or send to the client.
3. A saved financial calculation can reopen its proposed Change Order after reload without another Calculate action.

Record URL, deployed commit, browser/viewport, storage mode, attempt/project/request/draft IDs, source/review revisions and impact hash where supported. Use only synthetic data. Capture before/after text and state plus relevant request counts in the test environment; exclude cookies, tokens and real client text from evidence. Mark every case PASS, FAIL, BLOCKED or NOT RUN. A checklist is not a passing result.

Run the main paths on desktop and at 390 x 844. Check keyboard access, focus and readable labels. Do not require exact AI phrasing. Check the advice's meaning and its basis in the learner action and scenario rule. Database/live-provider checks are owned by Danila; UI checks by Arsen, acceptance by Albina.

## Fixtures and reproducible expectations

### Practice: A, the original attempt

Baseline: $1,500, 20 estimated hours, day 7, $75.00/hour. First booking request adds 6 hours.

- Target reply T: `I can add the booking feature at no extra charge and keep the original deadline.`
- If explicitly accepted, booking state is $1,500 / 26h / day 7 / $57.69 per hour.
- Complete the other requests with valid, explicitly accepted/declined actions to reach Results. Record the actual final state and full ordered history as A's reference, rather than assuming a predetermined final total.
- For the alternative B, the learner may enter: `I can add booking for an additional $400 with delivery extended by two days. Please confirm both terms.` If explicitly accepted, that booking state is $1,900 / 26h / day 9 / $73.08 per hour. A pending or rejected proposal must leave the agreed baseline unchanged.

Advice may explain the six hours without additional compensation and suggest clarifying requirements, proposing terms, trading scope or limiting a concession. It must not describe a commercially defensible free concession as inherently wrong. Alternatives are examples, not a required script or guaranteed client acceptance.

Add another target T2 after an earlier accepted amendment, and a repeated-text case where the same learner sentence occurs twice. These detect wrong turn selection and lost or double-applied prefix agreements.

### Real Project: saved proposal P and drafts D1/D2

Use the fictional website fixture in `tests/fixtures/real-project-v1-acceptance/mixed-website/`. Baseline: $1,500 / 20h / 2026-11-22. Review the analysis and select only booking; enter +6h, fixed +$400, additional expenses $20, extension 2 calendar days.

Saved proposal P: $1,900 / 26h / 2026-11-24 / $73.08 per hour. Incremental fee less additional expenses: $380. No removed tasks. Store the actual confirmed source/review revision, selected item IDs, assumptions and impact hash. The original contract remains $1,500 / 20h / November 22.

Create two separately identified saved response drafts D1 and D2 with different tones. Record their original server bodies and timestamps. In D1 append `QA UNSAVED D1: Please confirm the booking fields.` In D2 append `QA UNSAVED D2: We still need to agree the slot source.` These sentinels identify local edits; do not send them to a real client.

## 1. Improve this reply

| ID | Action | Expected result |
| --- | --- | --- |
| C01 | Open A's Results | A specific learner reply is shown with its turn context and practical advice. Text matches a real turn in A, not a fabricated or merely similar reply. |
| C02 | Check advice and evidence | The advice points to the action and applicable scenario rule or verified project consequence. It distinguishes asking a question from resolving requirements and proposing terms from accepting them. No invented trust/confidence percentage, competence claim or unsupported penalty. |
| C03 | Click Improve this reply for T | A separate attempt B with a different identity opens immediately before T. T and all later turns/agreements are absent from B. The client request awaiting T is the one shown in Results. |
| C04 | Use the first-turn target | B starts at $1,500 / 20h / day 7 with original scope and no accepted amendments. The free booking from T is not already applied. |
| C05 | Use later target T2 | B contains exactly the valid history before T2. Earlier accepted agreements apply once. Target and later agreements do not apply. Scope, fees, hours, deadline and any pending counteroffer match the verified prefix. |
| C06 | Select one of two identical reply texts | The selected turn identity and position determine the cut, not a text search or a fixed turn number. |
| C07 | Observe B before typing | No replacement is submitted automatically. Original wording may appear as an editable starting point, but the UI makes it clear the learner must rewrite and send it. Showing advice alone does not change economics or score a new action. |
| C08 | Write and send the paid alternative above | The engine validates the new action. Only explicit client acceptance changes booking to $1,900 / 26h / day 9. Reject/clarify/counteroffer paths preserve the last agreed state. No guaranteed successful outcome is hardcoded. |
| C09 | Reopen A and compare A/B | A's ID, messages, accepted agreements and final state remain unchanged. Comparison is labeled by attempt and derived from actual states. At the matched booking point: $0 versus +$400, same 26h, day 7 versus day 9 if the stated agreements were accepted. Do not compare a partial B as a completed full scenario without a clear label. |
| C10 | Finish B, then reopen both attempts | Each retains its own history and feedback; no history merge or overwrite. Replaying cached prefix turns must not reinterpret or double-charge them. A new learner submission may use the normal model path. |
| C11 | Repeated click, loading or a Replay/storage failure | No duplicate agreement, overwritten A, accidental submission or false success. A repeated click cannot create uncontrolled duplicate attempts; further deliberate Replay attempts must have separate identities. A friendly recoverable error preserves A and the learner's current input. |
| C12 | No justified coaching target / stale or invalid target | No fabricated quote/advice or silently wrong cut. Disable/hide the action or explain why replaying that target is unavailable. A target from another attempt/session cannot expose or modify it. |

## 2. Unsaved drafts across tabs

“Tabs” here means the response draft/tone tabs inside the product. Browser-tab switching is a separate spot check. Persistence across a hard reload, browser close, device change or deleted cookie is not promised by this requirement; do not label local edits “saved to server”.

| ID | Action | Expected result |
| --- | --- | --- |
| D01 | Edit D1, switch to D2, return to D1 | D1's exact unsaved text survives, including line breaks, quotes and Unicode. The UI indicates unsaved changes and offers an explicit save action. |
| D02 | Add D2 sentinel, alternate repeatedly | Each draft restores only its own local edits. D1 and D2 do not share a buffer or overwrite each other. |
| D03 | Switch tabs without pressing Save/Generate | No draft-update request, automatic generation or client-send action is triggered. The stored server bodies/timestamps remain unchanged when read independently in a controlled test. Normal read requests are allowed. |
| D04 | Copy the dirty D1 | Clipboard matches the currently visible local edit, not the previous server/generated body. Copying neither saves nor sends it. |
| D05 | Explicitly save D1, then switch tabs | Only D1 is saved; its dirty state clears after success. D2 remains locally edited and unsaved. Reload restores the saved D1 body. |
| D06 | Explicit save fails; then switch away/back | Error is visible, local text remains recoverable and marked unsaved, and explicit retry saves that text once without a false success. |
| D07 | Focus the editor, type and navigate with keyboard | Tab selection and editor focus remain usable; switching does not silently reset content or submit a form. Focus is visible. |
| D08 | Review/calculation changes while edits exist | Old edits are not reassigned to a new draft or new project/request. Earlier drafts remain clearly tied to their source/review/calculation. Stale edits cannot be presented as current agreed terms or overwrite the current draft silently. |
| D09 | Choose Discard edits / Restore generated text, if offered | Only the explicitly chosen draft is changed; visible dirty/saved status reflects the resulting text. Switching tabs alone never acts as discard. |
| D10 | Switch browser tabs and back | No accidental save/send and no loss from simply changing browser focus. Hard reload/cross-device recovery is reported separately, with the implementation's actual limit. |

## 3. Saved Change Order after reload

| ID | Action | Expected result |
| --- | --- | --- |
| O01 | Save P, reload, open project/request | The matching saved calculation is restored. Its proposed Change Order can be opened without pressing Calculate again or requiring a new AI call. Normal history/document reads are allowed. |
| O02 | Inspect document and copy it | Original baseline, selected booking only, +$400, +6h, $20 expenses, +2 days, November 24, assumptions and revision references match saved P. No sync/pages/copy items are added. Copied text matches the displayed document. |
| O03 | Inspect status and baseline | Clearly proposed/not accepted. No client signature, invoice, acceptance or updated baseline is invented. $380 is incremental fee less new expenses, not total profit. |
| O04 | Open saved free-work / equal-effort swap proposals | Document uses their saved values and removed task identities. Free work does not gain a fee; an equal 4h-for-4h swap does not increase total hours. Saved assumptions are preserved. |
| O05 | Edit an input without calculating, then reopen | Unsaved input does not alter a document for saved P. Either label the document as the previous saved proposal or mark it stale; never mix old money with newly edited scope/date. |
| O06 | Change source or confirmed review | Old P is clearly historical/stale, or the current document action requires a new verified calculation. Do not present it as valid for a newer source/review or silently regenerate terms. |
| O07 | Switch projects/requests, then open document | Each document is bound to its own selected IDs, calculation and revisions. Another project's terms never leak into it. |
| O08 | No saved calculation / malformed or unavailable saved data | Clear empty/error state and an explicit path to calculate or retry. No fabricated document, silently substituted totals, or accepted status. |
| O09 | Reload repeatedly, copy, or open twice | Read-only behavior: no duplicate calculation, amendment, AI generation, fee application or baseline mutation. |

## Execution sequence and release gate

- [ ] Fill the environment record and verify the deployment corresponds to the intended release.
- [ ] Run C01-C12 on first and later targets; preserve both attempts and compare outcomes at a matched point.
- [ ] Run D01-D10 with two independently identified drafts and inspect request side effects in a controlled environment.
- [ ] Run O01-O09, including reload and stale source/review cases.
- [ ] Repeat critical navigation, tab recovery and copy actions on mobile and with keyboard.
- [ ] Captain runs appropriate unit/API/Playwright and database checks. Mocked E2E responses are labeled as such; live-provider checks are reported separately.
- [ ] Log defects with ID, steps, actual/expected result, URL/commit and redacted evidence. Danila: prefix reconstruction, economics, identity, persistence, API; Arsen: target context, focus, tabs, recovery and document presentation.

Release blockers: original attempt overwritten; wrong Replay boundary; automatic submission; local edits lost solely through tab switching; implicit server save; false saved status; mixed/stale document presented as current; invented acceptance; wrong arithmetic or cross-session data disclosure.

Final report must include pass/fail counts and unexecuted cases, not “everything works”. These checks establish behavior on tested cases, not learning efficacy. The new coaching demo can be called live only after the deployed walkthrough passes. Until then use the presentation language below as a demonstration plan.

## Execution record: 15 November 2026

Environment: public https://scopeshift.vercel.app, in-app Chromium browser, real anonymous session and real AI responses, wholly fictional text. Repository main `84f93d4` merged into the QA branch before checks. The deployed UI does not expose its SHA; observed new features match this release, but deployed commit identity was not independently attested. Mobile spot check: 390 x 844, document width 375, no horizontal overflow at that step. Tab from the response editor reached Copy response. This is not a complete accessibility audit.

### Practice: advice, Replay and economics

Original Attempt 1, ID `4f76e584-ef5a-4678-a5f3-bd53283ea804`:

1. `I can add booking for an extra $400 and two more days.` Client explicitly accepted. State: $1,900 / 26h / day 9 / $73.08 per hour.
2. `I can deliver two days earlier for an extra $900.` Client counteroffered +$150 and day 7. Agreement state remained $1,900 / 26h / day 9. The UI explicitly said the counteroffer was not yet accepted.
3. Results quoted the exact $900 reply, identified `Respond to the negotiation`, stated that the client had not accepted it, and advised a clear defensible proposal or clarification. It did not supply a hidden budget or require an upsell.
4. Improve this reply opened Attempt 2 before that second turn. Booking appeared exactly once, the $900 exchange was absent from the conversation, the editor contained the original $900 text, and the UI stated that the learner must press Send. State before sending: $1,900 / 26h / day 9.
5. Manually replaced the text with `I can deliver two days earlier for an extra $150.` and pressed Send. Client explicitly accepted. New state: $2,050 / 26h / day 7 / $78.85 per hour.
6. Results displayed both attempts as **In progress**. Attempt 1's complete displayed Results text was identical before and after creating/sending Attempt 2. The comparison is between two partial histories at the same request position, not two completed scenarios. The extra $150 accompanies a two-day acceleration; a higher fee alone does not prove a better business decision.

Reproducible arithmetic: 1900/26 = 73.0769 -> $73.08; 2050/26 = 78.8462 -> $78.85. No rejected/pending fee was applied. Feedback referred to observable actions and accepted amendment records, not invented trust or competence percentages. The free-concession advice was separately checked by unit tests, not by another live free-work run here.

### Real Project: drafts and restored Change Order

Project `QA coaching recovery - fictional demo`, ID `e7300da2-80fb-4d4c-a85d-9abbc9d7d78e`; request `6d614533-46ce-4ecf-81d5-6efa41f3da31`; source 1 / confirmed interpretation 1.

Used the built-in fictional sample: $1,500 / 20h / **2026-11-28**, with approved gallery/testimonials amendment. This walkthrough intentionally differs from the matrix's November 22 fixture. Requested booking, slot selection, name/email and confirmation, without payments or calendar sync. AI returned four related subfeatures: booking/slot selection excluded with an exact scheduling-exclusion quote; booking-specific data/email details not specified. A negative request about no payments did not become added work. User reviewed the classifications.

Entered six hours **total for all four subfeatures**, fixed +$400, $20 expenses, +2 calendar days. Saved result: **proposed $1,900 / 26h / November 30 / $73.08 per hour / $380 incremental fee less expenses**. The original baseline stayed $1,500 / 20h / November 28. The $20 was not silently added to the client's fee, and overlapping subfeatures did not each receive another six hours.

Generated two separate live drafts (professional and friendly). Added different unsaved sentinel sentences, switched repeatedly, and verified each retained its own text and Unsaved label. Copy response copied the visible dirty professional ending. Explicitly saved professional only: its dirty marker cleared; friendly remained locally edited. Refreshed saved drafts, then explicitly discarded the friendly local edit; its body equaled the originally generated friendly response. Reload later restored the saved professional sentinel and the untouched friendly server body. This demonstrates the tested absence of implicit persistence; a network/SQL audit of every tab switch was not performed. No client-send action was invoked.

After reload, opened the saved project/request and immediately found Copy proposed Change Order. **Did not press Calculate, Analyze or Generate again.** The restored document's full text equaled its pre-reload text; clipboard copy matched it too. It retained source/review references, all selected items, assumptions, open questions, fee, hours and dates. Both its heading and status said proposed/not accepted; the response drafts requested confirmation before work. Review confirmation, calculation, draft generation, explicit draft save and reload did not mutate the baseline.

Evidence files in the delivered QA package: `results-advice.jpg`, `replay-before-send.jpg`, `attempt-comparison.jpg`, `independent-unsaved-drafts.jpg`, `restored-proposal-mobile.jpg`. The synthetic project and attempts are intentionally retained for review in the QA browser session; no real client data or client messages were sent.

### Checklist outcome, with strict coverage limits

PASS below means the stated ordinary walkthrough passed. NOT RUN also covers a case for which only a subset was checked. Automated supporting checks are separate from the manual counts.

| IDs | Status | Evidence / remaining coverage |
| --- | --- | --- |
| C01, C02, C03, C05, C07, C08, C09 | PASS | Exact reply/advice, later-turn prefix, manual replacement, unchanged original and partial-history comparison observed live |
| C04, C06, C10, C11, C12 | NOT RUN | No first-turn/repeated-text/full-completion/failure/stale-reference browser runs; unit tests cover some prefix/invalid-reference boundaries |
| D01, D02, D04, D05, D07, D09 | PASS | Independent dirty text, clipboard, explicit save, keyboard spot check and explicit discard observed |
| D03, D06, D08, D10 | NOT RUN | No complete network-count audit, forced save failure, stale-review edit case or browser-tab retention matrix |
| O01, O02, O03 | PASS | Full document equality after reload without Calculate, clipboard equality and proposed status |
| O04, O05, O06, O07, O08, O09 | NOT RUN | No complete free/swap document, unsaved-input, historical/source, cross-project, malformed-storage or repeated-request matrix; production-function tests support several boundaries |

Manual total: **16 PASS, 0 FAIL, 0 BLOCKED, 15 NOT RUN** out of 31. No blocker was observed in the tested core path. This is not full certification of the matrix or all production data.

### Automated checks and responsibilities

Locally executed on copied current repository source: 58 focused tests passed across `practice-coaching.test.ts`, `saved-change-order.test.ts`, `real-project-acceptance.test.ts` and `simulation-evaluation.test.ts`. Full unit suite: **434 passed / 14 skipped** (database integration unavailable). Node 24.22.1 local scratch environment; required Node 22 CI remains the reproducible release gate. The code tests verify source/prefix validation, original preservation at the 20-attempt limit, free-work trade-offs, proposal reconstruction and rejection of inconsistent saved data. They do not establish live model accuracy or physical database behavior.

Danila owns dedicated test DB/provider validation. Existing Playwright coaching tests use the rules backend; draft tests use explicit synthetic HTTP fixtures. Do not call either a real-provider browser test. Record final-head CI separately when available; earlier green CI is not evidence for an untested newer head.

### Content follow-ups, without changing implementation

- **P2, Arsen: unsupported exclusivity on the landing.** Published headings/body say `Nobody teaches the conversation` and `Today the only place to practice is a live project`. These conflict with the pitch's acknowledgement of existing practice products. Suggested heading: `Practice before the real conversation`. Suggested body: `Rehearse client pushback, review your decisions, and try another reply before using it with a client.` Do not repeat the exclusivity claim in the presentation.
- **P2, Danila: draft copy polish.** The professional opening says `Thank you for sharing this draft` although the input was a client request, and unresolved issues/questions are partly repetitive. Financial terms and proposed status remained correct. Prefer an opening about the request and deduplicate questions; this is a quality follow-up rather than an observed false agreement.
- **P2, Arsen: Practice handoff wording.** Real Project says the Practice contract `does not describe` booking, while the Practice contact-form scope explicitly says `No appointment scheduling`. Prefer `does not include appointment scheduling`. No erroneous state change was observed.

### Pitch versus published product

Checked the ten-page PDF against published Practice, Results/Replay, Real Project and landing pricing. Baseline, six-hour booking, $73.08/$78.85 revenue rates, user-supplied estimates, pasted-text limit, editable proposals and separate client acceptance match observed behavior. Landing still shows hypothetical **$9/month and $19/pack**, with payments disabled. Free-work arithmetic remains $1,500/26h = $57.69; not rerun as a live negotiation in this session.

Updated slide 4 to **Improve: Replay**, including exact-reply feedback and user-written replacement. Updated slide 5 cue and English notes for the observed counteroffer-to-Replay loop. The slide's complete paid/free routes still include the third scope-swap request; the short live walkthrough stops earlier and must retain its In progress label. PDF remains ten slides; all pages were rendered and visually inspected. Real Project's link opens the existing fictional scenario; it is not a new personalized scenario library. No learning gains, retention, legal certainty or willingness to pay were invented.

Short demonstration speech and click sequence: `pitch/short-talk-ru.md`. Use a prepared saved fictional Real Project result for a short presentation; do not claim that opening it is a new model run. If a live reply is slow, say so and show a clearly identified saved result rather than implying instant generation.
