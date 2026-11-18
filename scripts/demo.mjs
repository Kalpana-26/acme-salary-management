import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { salaryServer } from '../server/http.js';
import { openDatabase } from '../server/pay.js';
import { seed } from '../server/seed.js';

const db = openDatabase(':memory:');
seed(db);
const server = salaryServer(db).listen(0, '127.0.0.1');
await once(server, 'listening');
let browser;
let recordingDir;
try {
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || undefined });
  const output = 'artifacts';
  await mkdir(output, { recursive: true });
  recordingDir = await mkdtemp(join(tmpdir(), 'salary-demo-'));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const video = page.video();
  const url = 'http://127.0.0.1:' + server.address().port;
  const seconds = (count = 2) => page.waitForTimeout(count * 1000);

  await page.goto(url);
  await page.getByText('10,000 matching employees').waitFor();
  assert.equal(await page.getByRole('row').count(), 26);
  await seconds(3);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2 of 400').waitFor();
  await seconds();
  await page.getByLabel('Country', { exact: true }).selectOption('India');
  await page.getByText('2,000 matching employees').waitFor();
  await seconds(3);
  await page.getByLabel('Department', { exact: true }).selectOption('Engineering');
  await page.getByRole('button', { name: 'Edit salary', exact: false }).first().waitFor();
  await seconds();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByRole('searchbox').fill('1');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByText('1 matching employee', { exact: true }).waitFor();
  await seconds();
  await page.getByRole('button', { name: /Edit salary for .* #1$/ }).click();
  const salary = page.getByLabel('Annual base salary (USD)');
  await salary.fill('72000.50');
  await seconds();
  await page.getByRole('button', { name: 'Save salary' }).click();
  await page.getByText('Salary saved.').waitFor();
  await page.getByRole('listitem').filter({ hasText: 'USD 72,000.50' }).waitFor();
  await seconds(3);
  await page.getByRole('button', { name: 'Close salary record' }).click();
  await page.getByRole('cell', { name: 'USD 72,000.50' }).waitFor();
  await seconds(3);
  await context.close();
  const target = output + '/salary-management-demo.webm';
  await rm(target, { force: true });
  await rename(await video.path(), target);
  console.log('Browser walkthrough passed. Video saved to ' + target);
} finally {
  await browser?.close();
  if (recordingDir) await rm(recordingDir, { recursive: true, force: true });
  await new Promise(resolve => server.close(resolve));
  db.close();
}
