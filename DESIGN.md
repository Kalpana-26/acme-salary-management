# Design and development notes

## Architecture

```text
React browser UI --> same-origin HTTP API --> SQLite on a persistent volume
                          |
                          +--> production React assets
```

- The API keeps the directory and aggregate calculations in SQL. Both queries use the same predicate and run in a single read transaction so headcount and page rows reflect the same snapshot.
- Salaries are persisted as integer minor units. Decimal strings are validated before conversion. The supported currencies all use two decimal places. Average values are rounded to the nearest minor unit for display.
- Updates carry the version that the user opened. A write transaction acquires the SQLite writer lock, checks that version, and writes the salary and its history together. Repeating the current amount preserves the existing version and history.
- At 10,000 employees, offset pagination with 25 rows per page and a bounded scan for substring search and pay statistics keeps the implementation small. The name index supports stable ordering, and the history index supports per-employee lookup. Revisit full-text indexing or aggregate materialization if production measurements warrant it.
- The assessment uses synthetic records and a shared reviewer credential for remote access. An ACME rollout would require organization identity and access policies and an audit actor on each edit.

## AI workflow

Codex used the supplied assessment as the brief. The implementation sequence was requirements, schema and seed, HTTP API and React UI, tests, then deployment packaging and browser recording. Important checks included lossless money parsing, shared filters between analytics and the directory, preserving edits on reseed, stale-write rejection, and rollback when history insertion fails. Automated tests exercise an in-memory SQLite database and a loopback HTTP server. The Playwright walkthrough uses the production build against the actual HTTP and SQLite layers.
