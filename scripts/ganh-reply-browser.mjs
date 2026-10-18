// Local browser verification with explicit fixtures. Never connects to Supabase/OpenAI.
import puppeteer from 'puppeteer-core';
import { writeFile, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.GANH_REPLY_PREVIEW_URL || 'http://127.0.0.1:5173';
const fixturePath = new URL('../.ganh-reply-preview.html', import.meta.url);
await writeFile(fixturePath, `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#f5f5ef;margin:0;padding:20px;box-sizing:border-box;font-family:Arial,sans-serif"><div class="admin-shell" style="display:block"><div id="root"></div></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import Workspace from '/src/pages/admin/ganh-reply/GanhReplyWorkspace.jsx';import '/src/styles/admin/admin.css';createRoot(document.getElementById('root')).render(React.createElement(Workspace));</script></body></html>`);
const service = `
export const GANH_ENABLED = true;
export const GANH_PLATFORMS = [['tiktok','TikTok'],['facebook','Facebook'],['grabfood','GrabFood'],['shopeefood','ShopeeFood'],['google_maps','Google Maps']];
export const BRAIN_LABELS = {identity:'Brand Identity',voice:'Brand Voice',knowledge:'Kiến thức kinh doanh',principles:'Nguyên tắc',rule:'Quy tắc bổ sung'};
export const readReplyImage = async () => 'data:image/png;base64,AA==';
let current;
export async function ganhReplyRequest(action, body = {}) {
  window.__actions ||= []; window.__actions.push({action, body});
  if(action === 'bootstrap') return {access:{role:'admin',branch:null,brain:true,approve:true,user_id:'test-user'},branches:[]};
  if(action === 'analyze') {
    const result = {analysis:{feedback_type:'complaint',category:'Giá',emotion:'Phân vân',insight:'Muốn cảm thấy đáng tiền',expectation:'Hiểu giá trị món',public_risk:'Cần tránh tranh luận về giá',responsibility:'unknown',strategy:'Lắng nghe cảm nhận và giải thích giá trị',sensitivity:'low',channel:'public',verify:['Thông tin sản phẩm khách đang nhắc đến']},options:{A:'Bạn đang nhắc tới món nào vậy? Gánh muốn hiểu rõ cảm nhận của bạn hơn.',B:'Cảm nhận đáng tiền của bạn là điều Gánh quan tâm. Bạn chia sẻ món đã thử để Gánh hiểu thêm nhé.',C:'Gánh tôn trọng cảm nhận của bạn. Bạn chia sẻ thêm món đã chọn để cùng Gánh xem kỹ nhé.'},recommended:'B',reason:'Lắng nghe khách và giữ sự rõ ràng.'};
    current={feedback:{...body,id:'test-feedback',status:'draft',version:0,final_text:'',requires_review:false,created_by:'test-user',created_at:'2026-10-18T00:00:00Z',analysis:result.analysis},suggestion:{id:'test-suggestion',result}};return current;
  }
  if(action === 'save') {current={...current,feedback:{...current.feedback,final_text:body.text,status:body.approve?'approved':'pending',version:current.feedback.version+1,approved_version:body.approve?current.feedback.version+1:null}};return current;}
  if(action === 'copy') return {text:current.feedback.final_text};
  if(action === 'history') return {rows:current?[current.feedback]:[],count:current?1:0,page:0};
  if(action === 'detail') return current;
  if(action === 'list_brain') return {documents:[],rules:[],examples:[]};
  if(action === 'stats') return {total:0,approved:0,exactApproved:0,categories:{},emotions:{},branches:{}};
  return {ok:true};
}`;
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    if(req.url().includes('/src/services/ganhReplyService.js')) return req.respond({status:200,contentType:'application/javascript',body:service});
    if(!req.url().startsWith(base)) return req.abort();
    return req.continue();
  });
  await page.setViewport({width:1440,height:1100});
  await page.goto(`${base}/.ganh-reply-preview.html`, {waitUntil:'networkidle0'});
  await page.waitForSelector('.gr-tabs');
  await page.type('textarea[placeholder^="Dán bình luận"]','Giá mắc quá!');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.gr-options');
  assert.equal(await page.$$eval('.gr-options button', x => x.length),3);
  assert.equal(await page.$eval('.gr-options button[aria-pressed="true"] strong', e => e.textContent.includes('B.')),true);
  await page.screenshot({path:'/tmp/ganh-reply-desktop.png',fullPage:true});
  const clickText = async text => page.evaluate(text => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text); if(!b) throw Error('Missing '+text);b.click(); },text);
  await clickText('Lưu & gửi duyệt');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã lưu phiên bản'));
  await clickText('Duyệt phiên bản này');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã duyệt và lưu'));
  await clickText('Lịch sử');
  await page.waitForFunction(()=>document.body.innerText.includes('1 phản hồi trong phạm vi quyền'));
  await clickText('Mở');
  await page.waitForSelector('.gr-options');
  await page.setViewport({width:393,height:852});
  await page.screenshot({path:'/tmp/ganh-reply-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile overflow');
  await clickText('Gánh Brain'); await page.waitForFunction(()=>document.body.innerText.includes('Chưa có tài liệu'));
  await clickText('Dashboard'); await page.waitForFunction(()=>document.body.innerText.includes('Chưa có dữ liệu trong 30 ngày'));
  assert.equal(errors.length,0,errors.join('\n'));
  const actions = await page.evaluate(()=>window.__actions.map(x=>x.action));
  assert.ok(actions.includes('analyze')&&actions.includes('save')&&actions.includes('history'));
  console.log('Browser fixture checks passed: analyze -> select -> save -> approve -> history -> reopen; Brain and empty dashboard; desktop/mobile; no page errors.');
} finally { if(browser) await browser.close();await unlink(fixturePath).catch(()=>{}); }
