# Design and development notes

## Why this setup fits the assessment

```text
React browser UI --> same-origin HTTP API --> SQLite on a persistent volume
                          |
                          +--> production React assets
```

SQLite keeps the directory, salary history, and reporting queries in one database. A single Node process serves both the API and the React build. The deployment needs one persistent volume for the database.

- **Keep the overview consistent with the directory.** Directory and pay queries share the same filters and run in one read transaction. The browser receives 25 rows at a time, while the overview covers all matches. The seeded dataset exercises the full 10,000-row case in tests.
- **Show the distribution within each currency.** The dashboard groups matching salaries into up to five equal-width bands between the observed minimum and maximum, using integer minor units for the boundaries. Each employee belongs to one band, and the band counts add up to that currency’s headcount.
- **Let HR inspect the records behind a chart.** Chart selections carry their currency, department, or inclusive salary bounds into the directory. The API applies the same filters before pagination. Returning to the dashboard restores the analysis so the reviewer can explore another segment.
- **Store pay exactly.** The API validates decimal input and stores integer minor units. A salary such as `72000.50` is stored as `7200050`. Only the displayed average needs rounding.
- **Handle two editors opening the same record.** Each save includes the version the editor opened. SQLite checks that version inside the write transaction and saves the new amount and history entry together. A test forces the history write to fail and verifies that the salary stays at its original amount.
- **Keep the demo simple to run.** The seed is deterministic and can be rerun without losing salary changes. A rollout with real employee data would need organization sign-in, role-based access, and an identified actor on each audit entry.

## AI workflow

Codex assisted with scoping, implementation, tests, and the demo recording. The initial brief was the assessment prompt, and the Git history starts with the one-page requirements before the implementation commits.

During the first browser walkthrough, Playwright timed out trying to locate the country filter by its accessible label. Explicitly associating the labels with the filters and salary input resolved the issue. The recorded rerun exercises the built React app, HTTP API, and SQLite database together.
