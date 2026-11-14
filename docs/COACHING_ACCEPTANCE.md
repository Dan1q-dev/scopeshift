# Coaching and draft recovery: acceptance plan

Prepared 15 November 2026 by Albina. **Status: prepared, not executed.** Implementation is being developed in `codex/coaching-and-draft-recovery`. This document does not claim that the features are shipped, tested or effective at improving learning. No implementation files were changed for this plan. Final acceptance begins when the captain supplies the deployed URL and commit.

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
