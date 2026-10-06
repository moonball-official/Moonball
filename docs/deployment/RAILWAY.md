# Railway Deployment Runbook

- **Canonical domain:** `https://www.moonball.info`
- **Registrar:** GoDaddy
- **Application host:** Railway
- **Status (2026-09-16, America/Chicago):** Railway web service and PostgreSQL
  are online. `www.moonball.info` is attached to the web service on port `8080`,
  its Railway certificate is active, and the production site and health endpoint
  return HTTP 200 over HTTPS. GoDaddy permanently redirects the
  `https://moonball.info/` homepage to `https://www.moonball.info/`.

The React/Vite frontend and Express API deploy as one Railway web service. A
Railway PostgreSQL service supplies the persistent application database. The
on-chain project remains separate and is not deployed as a web service.

## Current deployment and domain handoff

- **Project:** `magnificent-stillness`
  (`609430d6-1ad0-4c0c-8aab-3b52a3faa9f5`)
- **Environment:** `production`
  (`9e391ab7-f668-4e20-89e1-a256039b2a7f`)
- **Web service:** `Moonball`
  (`544f0e7a-80c2-47bf-a692-99552f35731c`)
- **Production URL:** <https://www.moonball.info>
- **Staging URL:** <https://moonball-production-fdcf.up.railway.app>
- **Database:** `Postgres`, connected through the Railway `DATABASE_URL`
  reference; pre-deploy command `npm run db:migrate`; health check `/api/health`.
- **Domain target port:** `8080`, matching Railway's detected listener.

Read-only staging checks on 2026-09-16 at approximately 00:44 UTC returned
HTTP 200 for `/api/health`, `/`, `/protocol`, `/technical-paper`, and
`/api/powerball/live`. The live response reported `verificationStatus: "verified"`
with distinct `powerball.com` and `texaslottery.com` observations and
`verifiedAt: "2026-09-16T00:43:44.045Z"`. These are point-in-time HTTP and data
checks; repeat the pre-cutover checks below before changing production DNS.

A no-key Base Sepolia bridge preflight against the staging URL passed on
2026-09-16. It validated chain `84532`, oracle
`0x67B5b3147072bd13D4bA41eCF7f7b3531CED7EEE`, authorized updater
`0xa51690f5C451f428CcBDa048b4c720EA4962Ee5E`, source consensus, and a
read-only `eth_call` simulation. The initial preview changed before publication,
so the guarded publisher correctly required a fresh exact approval.

One approved Base Sepolia snapshot was then published and verified:

- sequence `1`;
- snapshot ID
  `0x93a9e3ce2dc35f75a220a47c3a326afc71812cbb1d919851cf866316d79c37c9`;
- `$271M` jackpot and `$115M` cash value; and
- source observation time `2026-09-16T23:52:09Z`.

An independent read-only check after publication confirmed the same sequence,
snapshot ID, and values, with `isFresh() == true`, updates unpaused, and core
deployment verification passing. The deployment remains a Base Sepolia
`candidate`; this rehearsal does not authorize another snapshot, mainnet, pool
creation, liquidity, or vesting.

A later no-key preflight against the canonical production source
`https://www.moonball.info/api/powerball/live` passed on 2026-09-16. It previewed
sequence `2`, snapshot ID
`0xa8f68915978253922a0834099f563ecac79b003998ae15af1935882279c88a5b`,
and the same `$271M` jackpot / `$115M` cash values. The read-only simulation
passed; no private key was loaded, no signature was requested, and sequence `2`
was not published. Publication still requires a new, explicit approval against a
fresh preview because live source data may change.

Railway originally supplied these exact records for the bare `moonball.info`
domain:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `@` | `urkezkuo.up.railway.app` |
| TXT | `_railway-verify` | `railway-verify=1927954ca7907f371abed5ff9c0069033bbc29ce4ddf355eb26af216d4ce4d9f` |

The apex CNAME requires a DNS provider supporting CNAME flattening, so it was
not applied at GoDaddy and no resolved Railway IP was substituted. The current
public nameservers are `ns15.domaincontrol.com` and `ns16.domaincontrol.com`.
The production cutover instead uses these exact Railway records:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `dv5u4xuv.up.railway.app` |
| TXT | `_railway-verify.www` | `railway-verify=cb9059a541a928055f5996441c74972e0179bae177ede1e426263136815e4ba4` |

Public lookups against the authoritative GoDaddy nameserver, Cloudflare
`1.1.1.1`, and Google `8.8.8.8` confirmed both records on 2026-09-16. The old
Replit records removed during the cutover were:

- `www` A record `34.111.179.208` (TTL 600);
- `www` TXT record
  `replit-verify=0ae2173f-2636-41e3-9fb8-18e991f9518a` (TTL 600).

The GoDaddy-managed apex A records `15.197.225.128` and `3.33.251.168` remain in
place for forwarding. The permanent redirect now points from `moonball.info` to
`https://www.moonball.info` without masking.

Do not treat this list as a complete DNS-zone backup. The Microsoft 365 MX,
Autodiscover, Skype/SIP, SPF, and DMARC records remain in place and must not be
changed during the website cutover.

The existing apex ownership TXT record and Railway Support challenge remain in
place:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_railway-verify` | `railway-verify=1927954ca7907f371abed5ff9c0069033bbc29ce4ddf355eb26af216d4ce4d9f` |
| TXT | `_railway.verify.www` | `k3mw9vx7` |

Railway Support released the stale `www.moonball.info` claim after validating
the challenge. Railway then accepted the hostname on the Moonball service and
issued its certificate. `PUBLIC_BASE_URL` was changed to
`https://www.moonball.info`; the resulting Railway deployment completed
successfully. Final checks returned HTTP 200 for the production homepage and
`/api/health`, whose response was `{"status":"ok","service":"moonball"}`.
An HTTPS request to `https://moonball.info` followed the permanent redirect to
`https://www.moonball.info` and returned HTTP 200.

An immediate post-change request to `https://moonball.info/protocol` returned
HTTP 404 from GoDaddy's forwarding layer instead of preserving the path. Use
the canonical `www` URLs for links and recheck deep-link forwarding after
GoDaddy's forwarding propagation window. If the 404 persists, path-preserving
apex redirects require a different redirect or DNS provider; do not replace the
working GoDaddy apex records with a guessed Railway IP.

The unused bare-domain attachment may still appear in Railway as waiting for an
apex DNS update and consumes one custom-domain slot. Removing that attachment is
an optional, separately approved Railway cleanup; it does not require changing
the GoDaddy-managed apex A records or the working root redirect.

## 1. Create a staging deployment

Create a Railway project from the GitHub repository
`moonball-official/Moonball`. Use the repository root for the web service.

Add a Railway PostgreSQL service, then add this reference variable to the web
service:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
PUBLIC_BASE_URL=https://www.moonball.info
```

`ANALYTICS_TOKEN` is optional. If it is enabled, generate it locally and put it
directly into Railway; never paste or commit the value.

Configure the web service:

```text
Build command:      npm run build
Pre-deploy command: npm run db:migrate
Start command:      npm start
Healthcheck path:   /api/health
```

Do not manually set `PORT`; Railway injects it and the server already binds to
it. Generate a Railway `*.up.railway.app` domain after the first successful
deployment.
Use the detected application port for the domain target; this deployment uses
`8080`, not the server's local fallback port `5000`.

## 2. Validate before DNS cutover

The generated Railway domain must pass all of these checks:

- `/api/health` returns `{"status":"ok","service":"moonball"}`;
- `/`, `/protocol`, and `/technical-paper` render correctly;
- `/api/powerball/live` returns HTTP 200 and `verificationStatus: "verified"`;
- `verificationSources` contains at least two unique sources;
- the source and verification timestamps are fresh; and
- the production logs contain no database, source-fetch, or startup errors.

Do not point the oracle bridge or GoDaddy DNS at the service until these checks
pass.

## 3. Connect `moonball.info`

Railway requires both its routing record and TXT ownership-verification record.
Copy the exact values Railway displays; do not invent DNS targets.

GoDaddy DNS does not provide the apex CNAME flattening Railway requires for a
bare root domain. Choose one of these approaches:

1. Keep GoDaddy DNS, attach `www.moonball.info` to Railway with the supplied
   CNAME and TXT records, and forward `moonball.info` to the HTTPS `www` URL.
2. Keep the registration at GoDaddy but delegate DNS to a provider with apex
   CNAME flattening, then attach the bare `moonball.info` domain to Railway.

If choosing the first approach, set `PUBLIC_BASE_URL=https://www.moonball.info`
when the verified `www` domain becomes canonical, then redeploy and verify the
generated canonical URLs. GoDaddy supports HTTPS domain forwarding; use an
unmasked redirect and verify both HTTP and HTTPS entry points, including paths.

Provider references: [Railway domain setup](https://docs.railway.com/networking/domains/working-with-domains)
and [GoDaddy HTTPS forwarding](https://www.godaddy.com/help/forward-my-godaddy-domain-12123).

Do not remove or overwrite unrelated MX, TXT, email, verification, or service
records in the GoDaddy zone.

## 4. Complete the cutover

After Railway shows the custom domain and certificate as active:

1. Confirm the site and API through the custom HTTPS domain.
2. Run the no-key Base Sepolia bridge preflight using that exact domain.
3. Review and approve the resulting sequence and snapshot ID separately.
4. Update operational documentation to replace the temporary Railway domain.

The Replit deployment is not part of this workflow and is not required by the
application build or runtime.
