import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderCompanyContracts } from './generate-company-contracts.mjs';

const lf = readFileSync(new URL('../docs/api/openapi.yaml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');

test('Windows and Linux checkouts generate identical complete company contracts', () => {
  const linux = renderCompanyContracts(Buffer.from(lf));
  const windows = renderCompanyContracts(Buffer.from(lf.replaceAll('\n', '\r\n')));
  assert.equal(windows, linux);
  assert.ok(linux.includes(`// SHA256: ${createHash('sha256').update(lf).digest('hex')}`));
  assert.ok(linux.includes('export type CaseStage ='));
  assert.ok(linux.includes('export type CaseApplication ='));
});

test('a changed specification still changes the fingerprint and fails a stale comparison', () => {
  const changed = lf.replace(/^([ \t]+version:)[^\n]+/m, '$1 company-regression-fixture');
  assert.notEqual(changed, lf, 'fixture must change the specification');
  assert.notEqual(renderCompanyContracts(changed), renderCompanyContracts(lf));
});
