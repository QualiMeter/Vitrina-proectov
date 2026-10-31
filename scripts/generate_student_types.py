"""Generate compile-time schema types; JSON Schema constraints remain server validated."""
import hashlib
import json
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[1]
source = root / 'docs/api/openapi.yaml'
schemas = yaml.safe_load(source.read_text())['components']['schemas']

def ts(s):
    if '$ref' in s:
        return s['$ref'].rsplit('/', 1)[1]
    if 'const' in s:
        return json.dumps(s['const'], ensure_ascii=False)
    if 'enum' in s:
        return ' | '.join(json.dumps(v) for v in s['enum'])
    for union in ('oneOf', 'anyOf'):
        if union in s:
            return '(' + ' | '.join(ts(x) for x in s[union]) + ')'
    t = s.get('type')
    if isinstance(t, list):
        return '(' + ' | '.join(ts({**s, 'type': x}) for x in t) + ')'
    if t == 'array':
        return '(' + ts(s.get('items', {})) + ')[]'
    if t == 'object' or 'properties' in s:
        required = s.get('required', [])
        if not s.get('properties'):
            return 'Record<string, never>' if s.get('additionalProperties') is False else 'Record<string, unknown>'
        return '{ ' + ' '.join(json.dumps(k) + ('' if k in required else '?') + ': ' + ts(v) + ';' for k, v in s.get('properties', {}).items()) + ' }'
    return {'integer': 'number', 'number': 'number', 'string': 'string', 'boolean': 'boolean', 'null': 'null'}.get(t, 'unknown')

# Generate only schemas required by the day 1 frontend adapter, including referenced schemas.
required = {'AuthSessionResponse','StudentProfilePrivate','StudentProfileUpdateRequest','StudentProfilePublic','ReferenceDataResponse','MyCaseParticipationListResponse','CsrfTokenResponse'}
def collect(value):
    if isinstance(value, dict):
        if '$ref' in value:
            name = value['$ref'].rsplit('/', 1)[1]
            if name not in required:
                required.add(name)
                collect(schemas[name])
        for child in value.values(): collect(child)
    elif isinstance(value, list):
        for child in value: collect(child)
for name in list(required): collect(schemas[name])

out = root / 'frontend/src/features/student/contracts.ts'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('// Generated from OpenAPI; do not edit by hand.\n// SHA256: ' + hashlib.sha256(source.read_bytes()).hexdigest() + '\n// Compile-time shapes only; conditional constraints are validated by the server.\n' + '\n'.join('export type ' + name + ' = ' + ts(schema) + ';' for name, schema in schemas.items() if name in required) + '\n')
