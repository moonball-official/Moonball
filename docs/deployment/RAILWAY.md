# Railway Deployment Runbook

- **Canonical domain:** `https://moonball.info`
- **Registrar:** GoDaddy
- **Application host:** Railway
- **Status:** Repository preparation complete; Railway project and GoDaddy DNS
  have not been changed.

The React/Vite frontend and Express API deploy as one Railway web service. A
Railway PostgreSQL service supplies the persistent application database. The
on-chain project remains separate and is not deployed as a web service.

## 1. Create a staging deployment

Create a Railway project from the GitHub repository
`moonball-official/Moonball`. Use the repository root for the web service.

Add a Railway PostgreSQL service, then add this reference variable to the web
service:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
PUBLIC_BASE_URL=https://moonball.info
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
