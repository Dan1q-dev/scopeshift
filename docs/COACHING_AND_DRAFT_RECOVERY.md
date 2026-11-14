# Targeted practice and saved proposal recovery

Results now offers **Improve this reply** with one observable practice focus, the exact original reply, and a concrete exercise. It uses verified turn actions and agreement status, not hidden client limits, invented skill scores or a new AI assessment. Free work is presented as a trade-off rather than an automatic mistake.

The link opens a separate Replay attempt before the selected turn. Existing earlier turns are restored through the normal server history path. The selected reply is prefilled for the learner to rewrite; it is not sent automatically. The original attempt stays available for comparison, including at the twenty-attempt browser limit. Only record IDs appear in the navigation URL; no message text is placed there. Missing or stale references do not create a branch.

Real Project Mode retains unsaved editor text while switching between draft tabs and shows an Unsaved marker. Inactive dirty editors still warn before closing the page. Refreshing saved drafts preserves the original optimistic save version while an edit is dirty, so an old edit cannot silently overwrite a newer server version. Saving and discarding remain explicit. This is in-memory tab retention, not autosave or recovery of unsaved edits after a reload or switching projects.

A saved Change Order is rebuilt from the request's original project snapshot, confirmed review, saved impact and impact reference. Opening history or refreshing it no longer requires Calculate again. Incomplete or inconsistent records yield no document rather than a fabricated proposal. Historical source versions retain the existing read-only controls.

No database migrations, secrets, API shapes or dependencies changed. Feedback and proposal recovery make no new paid AI calls. Sending a rewritten negotiation reply uses the existing interpreter/client-reply pipeline.

Local validation: typecheck, zero-warning lint, production build, 392 unit tests and four focused browser cases passed. The browser cases cover late-turn Replay/prefill/manual send/comparison, independent draft tab edits with explicit save/discard, preserved conflict tokens after refresh, inactive-draft close warnings, and saved Change Order recovery after reload. Real Project browser fixtures are synthetic; the coaching browser case uses the actual rules backend.
