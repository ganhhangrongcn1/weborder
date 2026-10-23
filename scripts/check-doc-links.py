"""Check repository Markdown file links; code examples and external URLs are excluded."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / 'AGENTS.md', *sorted((ROOT / 'docs').rglob('*.md')),
         ROOT / 'ghr-pos-mobile-native/README.md', ROOT / 'inventory-app/README.md',
         ROOT / 'src/services/supabase/README.md']
errors = []
for source in FILES:
    text = source.read_text(encoding='utf-8-sig')
    in_fence = False
    for number, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith(('```', '~~~')):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for match in re.finditer(r'\]\(([^\s)]+)(?:\s+"[^"]*")?\)', line):
            target = match.group(1).strip('<>')
            if re.match(r'^[a-zA-Z][\w+.-]*:|^#|^//', target):
                continue
            path = unquote(target.split('#')[0].split('?')[0])
            if not path:
                continue
            dest = (ROOT / path.lstrip('/')) if path.startswith('/') else (source.parent / path)
            if not dest.exists():
                errors.append(f'{source.relative_to(ROOT)}:{number}: {target}')
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'Document links passed: {len(FILES)} Markdown files (local file targets only).')
