import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'frontend/package.json'));
const { load } = require('js-yaml');
const source = readFileSync(resolve(root, 'docs/api/openapi.yaml'));
const schemas = load(source.toString()).components.schemas;
const required = new Set(['CaseDraft', 'CaseStage', 'CaseStageListResponse', 'CreateStageRequest',
  'UpdateStageRequest', 'CreateCheckpointRequest', 'UpdateCheckpointRequest', 'CaseCheckpoint',
  'CaseApplication', 'CaseApplicationListResponse', 'CaseApplicationDecisionRequest',
  'CompanyStudentProfile', 'CaseVersionCommand', 'CaseExecutionCommand']);
function collect(value) {
  if (Array.isArray(value)) return value.forEach(collect);
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
    const name = value.$ref.split('/').at(-1);
    if (!required.has(name)) { required.add(name); collect(schemas[name]); }
  }
  Object.values(value).forEach(collect);
}
[...required].forEach((name) => collect(schemas[name]));
function ts(schema) {
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  const union = schema.oneOf ?? schema.anyOf;
  if (union) return `(${union.map(ts).join(' | ')})`;
  if (Array.isArray(schema.type)) return `(${schema.type.map((type) => ts({ ...schema, type })).join(' | ')})`;
  if (schema.type === 'array') return `(${ts(schema.items ?? {})})[]`;
  if (schema.type === 'object' || schema.properties) {
    if (!schema.properties) return 'Record<string, unknown>';
    return '{ ' + Object.entries(schema.properties).map(([key, value]) =>
      `${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}: ${ts(value)};`).join(' ') + ' }';
  }
  return ({ integer: 'number', number: 'number', string: 'string', boolean: 'boolean', null: 'null' })[schema.type] ?? 'unknown';
}
const target = resolve(root, 'frontend/src/pages/company/workflow/contracts.generated.ts');
const rendered = '// Generated from docs/api/openapi.yaml. Run node scripts/generate-company-contracts.mjs\n'
  + '// SHA256: ' + createHash('sha256').update(source).digest('hex')
  + '\n// Conditional constraints are enforced by repository/server validation.\n'
  + Object.entries(schemas).filter(([name]) => required.has(name)).map(([name, schema]) => `export type ${name} = ${ts(schema)};`).join('\n') + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== rendered) throw new Error('Company contracts are stale');
  console.log('Company contracts match OpenAPI');
} else { mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, rendered); }
