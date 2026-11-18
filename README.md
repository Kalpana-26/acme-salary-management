# ACME salary management

An HR manager can use this app to answer questions like “What is the average base salary for Engineering in India?” and “When did this employee’s salary last change?” The app comes with 10,000 fictional employees across five countries.

[Watch the demo](artifacts/salary-management-demo.webm) · [Read the one-page requirements](REQUIREMENTS.md) · [See the design decisions and AI workflow](DESIGN.md)

## Try the HR workflow

1. Choose **India** and **Engineering**. The pay overview shows the number of employees and their average, minimum, and maximum annual base pay in INR.
2. Select **View matching employees** to open the directory with those filters. Select **Clear filters**, search for `ACME-0001` or `1`, and open **Edit**.
3. Enter a new salary and save. The change history shows the previous amount, the new amount, and when it changed. Close the record to see the updated salary in the directory.

The pay overview covers everyone who matches the filters, including employees on later pages.

## Run locally

Requires Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) and sign in as `admin`. The default loopback password is `acme-local-demo`. To set a local password, put `REVIEWER_PASSWORD` in the ignored `.env` file. The first startup creates and seeds `data/acme.sqlite`. You can also run `npm run seed` directly. Restarting or reseeding preserves edits.

Run `npm test` to check salary validation, filtered totals, stale edits, audit history, and the HTTP reviewer sign-in.

## Deploy

Build the included Dockerfile and run one instance on a container host with a persistent volume mounted at `/app/data`. The image listens on port 3000 and provides `GET /health`. Set `REVIEWER_PASSWORD` using the host's secret settings. Serve the instance over HTTPS and set `COOKIE_SECURE=1`. Reviewers sign in with username `admin` and the configured password. Sessions expire after eight hours or when the server restarts. The sample Compose file binds to loopback for local verification.

```sh
docker compose up --build -d --wait
```

Set `REVIEWER_PASSWORD` in your environment or in the ignored `.env` file before running Compose. Republishing the image preserves records as long as the same volume is mounted.

## Re-record the demo

```sh
npm run build
npx playwright install chromium
node scripts/demo.mjs
```

The script uses a disposable SQLite database. It asserts pagination, filtering, salary editing, audit history, and the refreshed directory before saving its video.
