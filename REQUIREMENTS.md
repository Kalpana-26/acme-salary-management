# ACME salary management

## Goal

ACME’s HR manager currently uses spreadsheets to maintain salary data for about 10,000 employees across several countries. The first release should make it easier to find and update an employee’s salary and answer basic questions about pay within a country or team.

## Scope and acceptance

- Find an employee by name or ID, or narrow the directory by country and department. Each row shows the employee’s role, location, and annual base salary with its currency.
- Enter a positive salary with up to two decimal places. After saving, the manager can see the old amount, the new amount, and the time of the change. If someone else saved first, ask the manager to reload the record.
- Show headcount and average, lowest, and highest gross annual base pay for the full set of matching employees. Group the figures by currency so the manager can interpret them without assuming an exchange rate.
- Make the assessment repeatable with a 10,000-employee fictional dataset, a React UI backed by a relational database, and automated checks for salary edits and pay summaries.

## Deliberate exclusions

- Payroll execution, deductions, benefits, bonuses, and tax calculations require country-specific policy and integrations beyond salary record management.
- FX conversion and purchasing-power comparisons require agreement on rate sources and dates. Native-currency summaries answer the first set of pay questions without those assumptions.
- Employee onboarding, spreadsheet import, bulk edits, approval chains, and effective-dated changes need separate validation and workflow design. The first release focuses on safe edits to existing records.
- Production single sign-on and retention rules depend on ACME’s policies. The assessment uses fictional data and supports a shared reviewer sign-in.
