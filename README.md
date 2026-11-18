# ACME salary management

A React application for reviewing and editing annual base pay for 10,000 fictional employees. See [the one-page requirements](REQUIREMENTS.md), [design and AI workflow notes](DESIGN.md), and [the recorded walkthrough](artifacts/salary-management-demo.webm).

## Run locally

Requires Node.js 24 and npm. From the repository root:

```sh
npm ci
npm test
npm run build
npm run seed
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The server also seeds on startup. Both seed paths are idempotent and preserve salary edits. The database defaults to `data/acme.sqlite`.

Search by name or ID, narrow results by country and department, and review pay statistics by currency. Use **Edit** to change an employee's salary and see its history. Try searching for ID `1`.

## Deploy

Build the included Dockerfile and run one instance on a container host with a persistent volume mounted at `/app/data`. The image listens on port 3000 and provides `GET /health`. Set `REVIEWER_PASSWORD` using the host's secret settings. The browser prompts for username `reviewer` and the configured password. Serve the instance behind an HTTPS endpoint. The sample Compose file binds to loopback for local verification.

```sh
docker compose up --build -d --wait
```

Set `REVIEWER_PASSWORD` in your environment before running Compose. Republishing the image preserves records as long as the same volume is mounted.

## Re-record the demo

```sh
npm run build
npx playwright install chromium
node scripts/demo.mjs
```

The script uses a disposable SQLite database. It asserts pagination, filtering, salary editing, audit history, and the refreshed directory before saving its video.
