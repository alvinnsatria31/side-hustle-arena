"""Read-only Arena integration inventory. Never emit credential values or payloads."""
import json
import pathlib
import re
import sqlite3
import subprocess
import sys
from urllib.parse import urlsplit


def endpoint(value):
    if not isinstance(value, str) or not value.startswith(('https://', 'http://')):
        return 'expression-or-unset'
    parsed = urlsplit(value)
    path = parsed.path
    if parsed.hostname in ('discord.com', 'discordapp.com') and '/webhooks/' in path:
        path = '/api/webhooks/[redacted]'
    return f'{parsed.scheme}://{parsed.hostname}{":" + str(parsed.port) if parsed.port else ""}{path}'


if '--runtime' in sys.argv:
    for path in ['/home/mindtrack/content_engine/.env', '/opt/pdf-factory/.env']:
        file = pathlib.Path(path)
        values = {}
        if file.exists():
            for line in file.read_text().splitlines():
                match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$', line)
                if match and re.search(r'ARENA|AI_|MODEL|STORAGE|COS_|R2_|SMTP|RESEND|AUTH|TOKEN|KEY', match[1]):
                    values[match[1]] = bool(match[2].strip().strip('\"\''))
        print(json.dumps({'environment_file': path, 'configured': values}))
    for file in pathlib.Path('/home/mindtrack/content_engine').glob('engine/*.py'):
        source = file.read_text()
        if 'agent' in source or '8791' in source:
            print(json.dumps({'bridge_source': str(file), 'contract_markers': {key: key in source for key in ['criterionId', 'version_id', 'rubric_breakdown', 'X-Arena-Token', 'Authorization', 'api_key', '/agent']},
                              'env_names': sorted(set(re.findall(r'(?:getenv|environ\.get)\([\"\']([A-Z0-9_]+)', source)))}))
    sys.exit(0)


def summarize_workflow(row, origin):
    nodes = json.loads(row['nodes']) if isinstance(row.get('nodes'), str) else row.get('nodes', [])
    encoded = json.dumps(nodes)
    relevant = []
    for node in nodes:
        params = node.get('parameters', {})
        kind = node.get('type', '')
        entry = {'name': node.get('name'), 'type': kind}
        if 'httpRequest' in kind:
            entry.update(url=endpoint(params.get('url')), method=params.get('method', 'GET'),
                         credential_types=list(node.get('credentials', {}).keys()))
            entry['header_names'] = [header.get('name') for header in params.get('headerParameters', {}).get('parameters', [])]
            entry['body_field_names'] = [field.get('name') for field in params.get('bodyParameters', {}).get('parameters', [])]
            entry['payload_markers'] = {key: key in json.dumps(params) for key in ['version_id', 'submission_id', 'criterionId', 'rubric_breakdown', 'Bearer ', 'X-Arena-Token']}
        if 'scheduleTrigger' in kind or 'cron' in kind.lower():
            entry['schedule'] = params.get('rule', params.get('triggerTimes', {}))
        if 'webhook' in kind.lower():
            entry['webhook_path'] = params.get('path')
        if any(key in kind.lower() for key in ['http', 'schedule', 'cron', 'webhook', 'agent', 'lmchat', 'code']):
            relevant.append(entry)
    print(json.dumps({'origin': origin, 'id': row.get('id'), 'name': row.get('name'), 'active': row.get('active'),
                      'node_count': len(nodes), 'nodes': relevant,
                      'contract_markers': {key: key in encoded for key in ['version_id', 'criterionId', 'source-id', 'submission_id', 'rubric_breakdown', 'ARENA_EVAL_TOKEN', '/api/webhooks/arena-eval', '/api/internal/reviews/claim']}}))


dbpath = pathlib.Path('/home/mindtrack/n8n/data/database.sqlite')
db = sqlite3.connect(f'file:{dbpath}?mode=ro', uri=True)
db.execute('PRAGMA query_only=ON')
db.row_factory = sqlite3.Row
for row in db.execute('SELECT id, name, active, nodes FROM workflow_entity'):
    if re.search(r'arena|quest|grading|sunday.release', row['name'], re.I):
        summarize_workflow(dict(row), 'live-n8n')
print(json.dumps({'credential_types': [dict(row) for row in db.execute('SELECT type, count(*) AS count FROM credentials_entity GROUP BY type')]}))
columns = {row[1] for row in db.execute('PRAGMA table_info(execution_entity)')}
if {'workflowId', 'status', 'startedAt'} <= columns:
    print(json.dumps({'recent_arena_executions': [dict(row) for row in db.execute('''
        SELECT e.workflowId, e.status, e.startedAt FROM execution_entity e
        JOIN workflow_entity w ON w.id=e.workflowId
        WHERE lower(w.name) LIKE '%arena%' OR lower(w.name) LIKE '%grading%'
        ORDER BY e.startedAt DESC LIMIT 12''')]}))
db.close()
for file in []:
    data = json.loads(file.read_text())
    for row in data if isinstance(data, list) else [data]:
        summarize_workflow(row, file.name)
for name in ['n8n', '9router']:
    data = json.loads(subprocess.check_output(['docker', 'inspect', name], text=True))[0]
    print(json.dumps({'container': name, 'network': data['HostConfig']['NetworkMode'],
                      'env_keys': sorted(entry.partition('=')[0] for entry in data['Config'].get('Env', []))}))
