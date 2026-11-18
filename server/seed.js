import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './pay.js';

export const defaultDatabase = process.env.DB_PATH || 'data/acme.sqlite';

const locations = [
  ['United States', 'USD', 5_200_000, 11_000_000],
  ['United Kingdom', 'GBP', 3_100_000, 7_000_000],
  ['Germany', 'EUR', 3_600_000, 8_000_000],
  ['India', 'INR', 54_000_000, 250_000_000],
  ['Canada', 'CAD', 5_800_000, 12_000_000],
];
const teams = [
  ['Engineering', 'Software Engineer'], ['Operations', 'Operations Analyst'],
  ['Finance', 'Financial Analyst'], ['People', 'People Partner'], ['Sales', 'Account Manager'],
];
const first = ['Avery', 'Taylor', 'Jordan', 'Morgan', 'Sam', 'Amara', 'Alex', 'Jamie', 'Priya', 'Noah'];
const last = ['Patel', 'Chen', 'Garcia', 'Martin', 'Singh', 'Khan', 'Kim', 'Nguyen', 'Miller', 'Costa'];

export function seed(db, count = 10_000) {
  const insert = db.prepare(`INSERT INTO employees (id, name, role, department, country, currency, cents)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let id = 1; id <= count; id++) {
      const [country, currency, base, spread] = locations[(id - 1) % locations.length];
      const [department, role] = teams[Math.floor((id - 1) / 7) % teams.length];
      const name = `${first[Math.floor(id / 3) % first.length]} ${last[Math.floor(id / 13) % last.length]}`;
      insert.run(id, name, role, department, country, currency, base + ((id * 104729) % spread));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  mkdirSync(dirname(defaultDatabase), { recursive: true });
  const db = openDatabase(defaultDatabase);
  seed(db);
  console.log(`Seed complete. ${db.prepare('SELECT count(*) AS total FROM employees').get().total} employees.`);
  db.close();
}
