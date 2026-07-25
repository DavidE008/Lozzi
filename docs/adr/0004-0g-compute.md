# ADR 0004: 0G Compute is server-oriented

Status: Accepted

Later 0G inference uses the Router path behind a server provider. Direct SDK
access is excluded from browser code. Requests must be redacted, policy-gated,
logged without PII, and unable to mutate academic records directly.
