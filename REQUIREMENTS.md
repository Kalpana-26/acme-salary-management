# ACME salary management

## Goal

An HR manager can find an employee, correct their annual base salary, and answer how ACME pays its 10,000 employees across countries without working from spreadsheets.

## Scope and acceptance

- Browse a paginated directory and search by employee name or ID. Filter by country and department. Show employee, role, location, and annual base salary with its currency.
- Open a salary record, save a positive amount with up to two decimal places, and inspect its change history. Save the change and history atomically. Reject stale edits and tell the manager to reload the record.
- Show headcount, average, minimum, and maximum annual base salary under the active filters, grouped by currency. Amounts are gross annual base pay. Separate currencies prevent misleading cross-country totals.
- Provide a reproducible 10,000-employee fictional dataset, a React UI, a relational database, and automated tests for pay validation, history, filtering, aggregation, and concurrency. The deployed assessment instance uses synthetic data.

## Deliberate exclusions

- Payroll execution, deductions, benefits, bonuses, and tax calculations require country-specific policy and integrations beyond salary record management.
- FX conversion and purchasing-power comparisons require agreement on rate sources and dates. Native-currency summaries answer the first set of pay questions without those assumptions.
- Employee onboarding, spreadsheet import, bulk edits, approval chains, and effective-dated changes need separate validation and workflow design. The first release focuses on safe edits to existing records.
- Production HR identity integration and retention policy require ACME decisions. The hosted demonstration uses a shared reviewer credential and fictional data.
