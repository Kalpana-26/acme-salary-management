import { DatabaseSync } from 'node:sqlite';

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      country TEXT NOT NULL,
      currency TEXT NOT NULL,
      cents INTEGER NOT NULL CHECK(cents BETWEEN 1 AND 1000000000),
      version INTEGER NOT NULL DEFAULT 1
    ) STRICT;
    CREATE INDEX IF NOT EXISTS employee_name ON employees(name COLLATE NOCASE, id);
    CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      previous_cents INTEGER NOT NULL,
      new_cents INTEGER NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE INDEX IF NOT EXISTS employee_history ON changes(employee_id, id DESC);
  `);
  return db;
}

export function parseSalary(value) {
  if (typeof value !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) {
    throw new InputError('Enter an amount with up to two decimal places.');
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents < 1 || cents > 1_000_000_000) {
    throw new InputError('Enter an amount between 0.01 and 10,000,000.');
  }
  return cents;
}

export function directory(db, params) {
  const search = (params.get('q') ?? '').trim().slice(0, 100);
  const idMatch = /^(?:ACME-)?(\d+)$/i.exec(search);
  const searchedId = Number(idMatch?.[1]);
  const page = Number(params.get('page') ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
    throw new InputError('Invalid page.');
  }
  const country = params.get('country') ?? '';
  const department = params.get('department') ?? '';
  const args = [search, Number.isSafeInteger(searchedId) ? searchedId : null, country, country, department, department];
  const where = `WHERE (instr(lower(name), lower(?)) > 0 OR id = ?)
    AND (? = '' OR country = ?) AND (? = '' OR department = ?)`;
  const pageSize = 25;
  db.exec('BEGIN');
  try {
    const employees = db.prepare(`SELECT * FROM employees ${where}
      ORDER BY name COLLATE NOCASE, id LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    const summary = db.prepare(`SELECT currency, count(*) AS headcount,
      round(avg(cents)) AS average, min(cents) AS minimum, max(cents) AS maximum
      FROM employees ${where} GROUP BY currency ORDER BY currency`).all(...args);
    db.exec('COMMIT');
    return { employees, summary, page, pageSize, total: summary.reduce((n, row) => n + row.headcount, 0) };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function employeeDetail(db, id) {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) throw new InputError('Employee not found.', 404);
  const history = db.prepare('SELECT * FROM changes WHERE employee_id = ? ORDER BY id DESC').all(id);
  return { employee, history };
}

export function updateSalary(db, id, amount, version) {
  const cents = parseSalary(amount);
  if (!Number.isSafeInteger(version) || version < 1) throw new InputError('Invalid record version.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const { employee } = employeeDetail(db, id);
    if (employee.version !== version) throw new InputError('This salary has changed. Reload the record and try again.', 409);
    if (employee.cents !== cents) {
      db.prepare('UPDATE employees SET cents = ?, version = version + 1 WHERE id = ?').run(cents, id);
      db.prepare('INSERT INTO changes(employee_id, previous_cents, new_cents) VALUES (?, ?, ?)')
        .run(id, employee.cents, cents);
    }
    const result = employeeDetail(db, id);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
