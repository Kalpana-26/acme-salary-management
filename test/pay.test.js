import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { directory, employeeDetail, openDatabase, parseSalary, updateSalary } from '../server/pay.js';
import { seed } from '../server/seed.js';
import { salaryServer } from '../server/http.js';

function fixture(t, count = 50) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  seed(db, count);
  return db;
}

test('salary parsing preserves minor units and rejects unsupported amounts', () => {
  assert.equal(parseSalary('0.01'), 1);
  assert.equal(parseSalary('12345.6'), 1_234_560);
  assert.equal(parseSalary('10000000.00'), 1_000_000_000);
  for (const input of [50, null, '', '0', '-1', '1.001', '1e3', '1,000', '10000000.01']) {
    assert.throws(() => parseSalary(input), { status: 400 });
  }
});

test('directory pages a 10,000-person seed and keeps currencies separate', t => {
  const db = fixture(t, 10_000);
  const full = directory(db, new URLSearchParams());
  assert.equal(full.total, 10_000);
  assert.equal(full.employees.length, 25);
  assert.equal(full.summary.length, 5);
  assert.ok(full.summary.every(row => row.headcount === 2000 && row.minimum <= row.average && row.average <= row.maximum));
  const next = directory(db, new URLSearchParams({ page: '2' }));
  assert.ok(next.employees.every(row => !full.employees.some(first => first.id === row.id)));
  assert.throws(() => directory(db, new URLSearchParams({ page: '0' })), { status: 400 });
});

test('search and combined filters apply equally to the directory and summary', t => {
  const db = fixture(t);
  const { employee } = employeeDetail(db, 1);
  const result = directory(db, new URLSearchParams({ q: '1', department: employee.department, country: employee.country }));
  assert.deepEqual(result.employees.map(row => row.id), [1]);
  assert.deepEqual({ ...result.summary[0] }, {
    currency: employee.currency, headcount: 1, average: employee.cents,
    minimum: employee.cents, maximum: employee.cents,
  });
  assert.ok(directory(db, new URLSearchParams({ q: employee.name.toLowerCase() })).total > 0);
  assert.equal(directory(db, new URLSearchParams({ q: '%' })).total, 0);
  assert.equal(directory(db, new URLSearchParams({ q: '1', country: 'Canada' })).total, 0);
});

test('updates preserve history, reject stale writes, and survive reseeding', t => {
  const db = fixture(t);
  const { employee } = employeeDetail(db, 1);
  const saved = updateSalary(db, 1, '65000.12', employee.version);
  assert.equal(saved.employee.version, 2);
  assert.equal(saved.employee.cents, 6_500_012);
  assert.equal(saved.history[0].previous_cents, employee.cents);
  assert.equal(saved.history[0].new_cents, saved.employee.cents);
  assert.throws(() => updateSalary(db, 1, '75000', employee.version), { status: 409 });
  assert.equal(updateSalary(db, 1, '65000.12', 2).history.length, 1);
  seed(db, 50);
  assert.deepEqual(employeeDetail(db, 1), saved);
  assert.throws(() => updateSalary(db, 99, '75000', 1), { status: 404 });
});

test('rolls back the salary update when the history write fails', t => {
  const db = fixture(t);
  const before = employeeDetail(db, 1);
  db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON changes BEGIN SELECT RAISE(ABORT, 'history unavailable'); END");
  assert.throws(() => updateSalary(db, 1, '99999', before.employee.version), /history unavailable/);
  assert.deepEqual(employeeDetail(db, 1), before);
});

test('HTTP reviewer gate and salary update work over actual requests', async t => {
  const db = fixture(t);
  const server = salaryServer(db, { password: 'test-password' }).listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { Authorization: 'Basic ' + Buffer.from('reviewer:test-password').toString('base64') };
  assert.equal((await fetch(base + '/health')).status, 200);
  assert.equal((await fetch(base + '/api/employees')).status, 401);
  assert.equal((await fetch(base + '/api/employees', { headers })).status, 200);
  const patch = body => fetch(base + '/api/employees/1', {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body,
  });
  assert.equal((await patch('{')).status, 400);
  const result = await patch(JSON.stringify({ amount: '72000', version: 1 }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).employee.cents, 7_200_000);
  assert.equal((await patch(JSON.stringify({ amount: '73000', version: 1 }))).status, 409);
});
