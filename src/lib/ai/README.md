# Negotiation interpretation

`interpretMessage` currently runs the deterministic, bounded English `rules-v1`
interpreter. The API identifies it in `X-ScopeShift-Interpreter`; no LLM is called.
Unsupported or ambiguous text produces clarification instead of an amendment.

The engine makes all client acceptance decisions, computes money and estimates,
and generates replies from those actual decisions. A provider must never assign
the project state or bypass scenario policies.

Before adding a nondeterministic provider, persist validated interpreted turns
and their exact history prefixes durably. The current process-local fingerprint
map is not a persistent LLM replay store. See `docs/BACKEND_INTEGRATION.md`.
