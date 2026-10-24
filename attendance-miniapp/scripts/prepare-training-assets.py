"""Package original sample resources for the authenticated demo file endpoint."""
from pathlib import Path
import base64, json
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[1]
assets = root / 'src/assets'
function = root.parent / 'supabase/functions/attendance-training-assets'
function.mkdir(parents=True, exist_ok=True)
files = {}
for key, name, mime in [('guide', 'huong-dan-cham-cong.pdf', 'application/pdf'), ('video', 'huong-dan-cham-cong.mp4', 'video/mp4')]:
    files[key] = {'name': name, 'type': mime, 'base64': base64.b64encode((assets / name).read_bytes()).decode()}
(function / 'assets.ts').write_text('export const assets = ' + json.dumps(files) + ';\n', encoding='utf-8')
pdf = pdfium.PdfDocument(assets / 'huong-dan-cham-cong.pdf')
assert len(pdf) == 1, 'Update the preview component when adding more PDF pages.'
pdf[0].render(scale=1.5).to_pil().save(assets / 'huong-dan-cham-cong-trang-1.png')
print('Prepared PDF page preview and 2 authenticated media assets.')
