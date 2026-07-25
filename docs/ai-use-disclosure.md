# AI-use disclosure

AI tools assisted with product documentation, interface implementation, test
generation, and code review. All generated output is treated as untrusted:
maintainers review diffs, run deterministic tests, inspect migrations and
policies, and compare the rendered product against approved references.

No real student data is supplied to an AI provider. The Milestone 5 0G
integration is server-only, opt-in, policy-gated, minimized,
capability-labeled, and schema-validated. Lozzi stores commitments and
operational metadata rather than plaintext prompts or responses in general
logs or PostgreSQL.

0G output may explain the deterministic degree audit, highlight progress,
suggest questions or possible next courses, and identify risks for human
review. It never calculates the official GPA, creates requirements, awards
credit, changes enrollment, alters an academic record, or makes a final
institutional decision.
