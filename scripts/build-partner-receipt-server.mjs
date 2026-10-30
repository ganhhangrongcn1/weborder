import { build } from 'esbuild';
for (const [entry, name] of [['src/services/receiptRenderCore.js', 'receiptCore'],
  ['src/services/partnerReceiptOrder.js', 'partnerReceiptOrder']]) {
  await build({ entryPoints: [entry], outfile: `supabase/functions/nexpos-order-shadow-sync/${name}.bundle.mjs`,
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', define: { 'import.meta.env': '{}' } });
}
