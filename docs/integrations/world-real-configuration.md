# World real configuration

This runbook separates World Developer Portal administration from the Lozzi
runtime. The Portal key is an operator credential and must never be made
available to the application, browser, deployment platform, CI, or repository.

## Credential boundaries

| Value                               | Consumer                    | Storage boundary                                      |
| ----------------------------------- | --------------------------- | ----------------------------------------------------- |
| World Developer API key             | Codex Portal MCP only       | Codex MCP configuration after local rotation          |
| `NEXT_PUBLIC_WORLD_APP_ID`          | Browser and server          | Local runtime configuration                           |
| `WORLD_RP_ID`                       | Server only                 | Ignored `apps/web/.env.local`                         |
| `WORLD_RP_SIGNING_KEY`              | Server only                 | Ignored `apps/web/.env.local`; recoverable secret     |
| `WORLD_ID_ENVIRONMENT`              | Browser response and server | `staging`, `sandbox`, or `production`                 |
| `SUPABASE_SERVICE_ROLE_KEY`         | Server only                 | Ignored `apps/web/.env.local`; never sent to a client |
| `AGENTKIT_HUMAN_ID_HMAC_KEY`        | Server only                 | Ignored local secret storage; 32 random bytes         |
| `WORLD_CHAIN_MAINNET_RPC_URL`       | Server and demo tooling     | Configurable canonical AgentBook reads                |
| `AGENTKIT_AGENT_ADDRESS`            | Server and demo tooling     | Public checksummed address only                       |
| Demo-agent private key and password | Agent demo client only      | Encrypted keystore outside the repository             |

The World Developer key that appeared in chat is considered compromised. It
must be revoked in the Developer Portal. Do not test it, copy it into a shell
history, or reuse it.

After rotating it locally, connect the replacement without putting the value in
this repository:

```powershell
codex mcp add world-developer-portal --env WORLD_DEVELOPER_API_KEY='<ROTATED_KEY>' -- npx -y mcp-remote https://developer.world.org/api/mcp --transport http-only --header 'Authorization:Bearer ${WORLD_DEVELOPER_API_KEY}'
```

Restart Codex after adding the MCP. Report only that it is connected; do not
paste the replacement key into chat.

## Portal inventory and provisioning

Use the Portal MCP to inspect the current team before creating anything:

1. Reuse a matching production external/cloud app named **Lozzi** when one
   exists.
2. Inspect its managed World ID 4.0 relying party and both environments.
3. If the relying-party signing key is not recoverable from ignored local
   storage, stop before rotation and obtain explicit approval.
4. Otherwise, create the app and relying party and immediately place the
   one-time signing key in ignored local secret storage.
5. Create the following action identifiers in staging and production:

| Purpose                  | Action identifier                    |
| ------------------------ | ------------------------------------ |
| Account humanity         | `lozzi-student-verification`         |
| Sensitive-share liveness | `lozzi-sensitive-share-selfie-check` |
| Adult self-consent       | `lozzi-adult-share-consent`          |

Poll until the intended relying-party environments report `registered`.
Confirm Selfie Check partner access and Identity Check preview access instead
of substituting a weaker credential when either capability is unavailable.

## Test environment matrix

| Environment  | Intended evidence                                                |
| ------------ | ---------------------------------------------------------------- |
| `staging`    | Proof of Human with the World simulator                          |
| `sandbox`    | Selfie Check hot/cold paths in the dedicated Sandbox application |
| `production` | Real World App Proof of Human and minimum-age Identity Check     |

Sandbox and staging evidence must never be presented as production
verification. Production device testing happens locally before any hosted
deployment.

## AgentBook boundary

The degree-planning agent uses World AgentKit's canonical AgentBook on World
Chain mainnet (`eip155:480`). This does not change Lozzi's future registry
contract target of World Chain Sepolia (`4801`).

The demo-agent address is public, zero-value, and has no custody or academic
write authority. Its private key is created in an encrypted local keystore and
is never stored in an environment variable. Before registration, show the
checksummed address, chain ID `480`, registration purpose, and relay behavior
and wait for explicit approval of the World App QR. Verify the final transaction
through a separately configured RPC read.

Dedicated demo-agent registration preview:

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Address        | `0xA8619B20cd66BBf9c3684EfE7D0B099DfE98AD5f`                          |
| Network        | World Chain mainnet, chain ID `480` (`eip155:480`)                    |
| Purpose        | Message-only AgentKit identity for minimized degree-plan proposals    |
| Relay behavior | World’s canonical CLI submits through its hosted registration relay   |
| Authority      | No student linkage, custody, spending, enrollment, or academic writes |

The encrypted keystore and its randomly generated password are both ignored
under `.secrets/`. Registration remains paused until the operator explicitly
approves this exact address/network/purpose/relay combination and completes the
World App QR.

## Local AgentKit demo

1. Put the checksummed address above in `AGENTKIT_AGENT_ADDRESS`.
2. Configure `WORLD_CHAIN_MAINNET_RPC_URL`,
   `AGENTKIT_HUMAN_ID_HMAC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `NEXT_PUBLIC_APP_URL` in ignored local runtime storage.
3. Start the web app.
4. As the synthetic student, open **Degree progress**, create the 30-minute
   delegation, and copy it once.
5. Run `pnpm --filter @lozzi/web agentkit:demo`. Paste the delegation only into
   the hidden local prompt.
6. The agent reads completion/eligibility flags and course codes, submits only
   a pending proposal, and Casey Nguyen reviews it at `/advisor`.

The three-use AgentKit counter is atomic per anonymous-human commitment and
endpoint. Each student delegation is stricter: it allows one `degree-plan:read`
and one `degree-plan:propose` use.

## Current provisioning status

- Portal operator key: rotated locally by the operator.
- Portal MCP visibility in this Codex session: unavailable; connector restart
  or exposure is still required before administration can be verified.
- Legacy app ID supplied by the operator:
  `app_406624a7ab8b70f37f662453518dda71`.
- RP ID supplied by the operator: `rp_27a81819333b3230`.
- Existing Lozzi app/RP inspection: pending callable Portal MCP.
- Selfie Check access: not yet confirmed.
- Identity Check access: not yet confirmed.
- Staging/production actions: not yet confirmed.
- AgentBook keystore: generated locally and ignored.
- AgentBook registration: deliberately paused before the World App QR.
