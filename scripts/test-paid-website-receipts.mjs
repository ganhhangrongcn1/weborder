// Install @electric-sql/pglite into a temporary directory, then pass its module path.
// This test uses an isolated in-memory PostgreSQL database, never production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.argv[2];
if(!modulePath) throw new Error('Usage: node scripts/test-paid-website-receipts.mjs /path/to/pglite/dist/index.js');
const {PGlite}=await import(pathToFileURL(path.resolve(modulePath)).href);
const db=new PGlite();
try {
 await db.exec(await fs.readFile(new URL('./fixtures/paid-website-receipt.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../supabase/migrations/20261020122126_paid_website_receipt_stamps.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../docs/supabase-sql/20261020_paid_website_receipt_stamps_test.sql',import.meta.url),'utf8'));
 const {rows}=await db.query("select count(*)::int as jobs from public.print_jobs where source_type='website_paid_receipt'");
 assert.equal(rows[0].jobs,1);
 console.log('PASS: authoritative paid snapshot, retained preparation ticket, one follow-up, no duplicate bundle, unchanged stamps.');
} finally { await db.close(); }
