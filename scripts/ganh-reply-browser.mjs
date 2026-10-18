// Browser checks use explicit API/clipboard fixtures; no Supabase/OpenAI requests or test statistics are persisted.
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
const scenario = new URLSearchParams(window.location.search).get('scenario') || 'admin';
const staff = scenario.startsWith('staff');
const sensitive = scenario.includes('sensitive') || scenario === 'approval-mismatch';
let current;
export async function ganhReplyRequest(action, body = {}) {
  window.__actions ||= []; window.__actions.push({action,body});
  if(action === 'bootstrap') return {access:{role:staff?'staff':'admin',branch:null,brain:!staff,approve:!staff,user_id:'test-user'},branches:[]};
  if(action === 'analyze') {
    const analysis={feedback_type:'complaint',category:'Giá',emotion:'Phân vân',insight:'Muốn cảm thấy đáng tiền',expectation:'Hiểu giá trị món',public_risk:'Cần tránh tranh luận về giá',responsibility:'unknown',strategy:'Lắng nghe cảm nhận và giải thích giá trị',sensitivity:sensitive?'high':'low',channel:'public',verify:['Thông tin sản phẩm khách đang nhắc đến']};
    const result={analysis,options:{A:'Bạn đang nhắc tới món nào vậy? Gánh muốn hiểu rõ cảm nhận của bạn hơn.',B:'Cảm nhận đáng tiền của bạn là điều Gánh quan tâm. Bạn chia sẻ món đã thử để Gánh hiểu thêm nhé.',C:'Gánh tôn trọng cảm nhận của bạn. Bạn chia sẻ thêm món đã chọn để cùng Gánh xem kỹ nhé.'},recommended:'B',reason:'Lắng nghe khách và giữ sự rõ ràng.'};
    current={feedback:{...body,id:'test-feedback',status:'draft',version:0,final_text:'',requires_review:sensitive,created_by:'test-user',created_at:'2026-10-18T00:00:00Z',analysis},suggestion:{id:'test-suggestion',result}};return current;
  }
  if(action === 'save') {
    const version=current.feedback.version+1;
    current={...current,feedback:{...current.feedback,final_text:body.text,status:body.approve?'approved':'pending',version,approved_version:body.approve?(scenario==='approval-mismatch'?version-1:version):null}};return current;
  }
  if(action === 'copy') {
    if(current.feedback.requires_review && (current.feedback.status!=='approved' || current.feedback.approved_version!==current.feedback.version)) throw Error('Chưa được duyệt.');
    return {text:current.feedback.final_text};
  }
  if(action === 'rewrite') {
    current={...current,feedback:{...current.feedback,status:'draft',final_text:'',approved_version:null,version:current.feedback.version+1},suggestion:{...current.suggestion,result:{...current.suggestion.result,options:{...current.suggestion.result.options,B:'Bản viết lại ngắn gọn, giữ nguyên dữ kiện.'}}}};return current;
  }
  if(action === 'history') return {rows:current?[current.feedback]:[],count:current?1:0,page:0};
  if(action === 'detail') return current;
  if(action === 'list_brain') return {documents:[],rules:[],examples:[]};
  if(action === 'stats') return {total:0,approved:0,exactApproved:0,categories:{},emotions:{},branches:{}};
  return {ok:true};
}`;
let browser;
try {
  browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage(); const errors=[];
  // Headless host clipboard permissions are separate from the app's save/review contract.
  await page.evaluateOnNewDocument(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText:async text=>{
        if(new URLSearchParams(window.location.search).get('scenario')==='clipboard-denied' && !window.__clipboardDeniedOnce){
          window.__clipboardDeniedOnce=true;throw new window.DOMException('Clipboard denied','NotAllowedError');
        }
        window.__clipboard=text;
      },
      readText:async()=>window.__clipboard || ''
    }});
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
    if(req.url().includes('/src/services/ganhReplyService.js')) return req.respond({status:200,contentType:'application/javascript',body:service});
    if(!req.url().startsWith(base)) return req.abort();
    return req.continue();
  });
  const clickText=async text=>{
    const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),text);
    const button=handle.asElement();
    if(!button || await button.evaluate(e=>e.disabled)) throw Error('Missing/disabled button: '+text);
    await button.click();await handle.dispose();
  };
  const start=async scenario=>{
    await page.goto(base+'/.ganh-reply-preview.html?scenario='+scenario,{waitUntil:'networkidle0'});
    await page.waitForSelector('.gr-tabs');
    assert.equal(await page.$eval('textarea[placeholder^="Ví dụ"]',e=>e.closest('details').open),false,'Optional context starts collapsed');
    await page.type('textarea[placeholder^="Dán bình luận"]','Giá mắc quá!');
    await clickText('Tạo gợi ý trả lời');
    await page.waitForSelector('.gr-reply-card');
  };
  await page.setViewport({width:1440,height:1100});
  await start('admin');
  assert.equal(await page.$eval('.gr-alternatives',e=>e.open),false);
  assert.equal(await page.$eval('textarea[aria-label="Câu trả lời"]',e=>e.value.startsWith('Cảm nhận đáng tiền')),true);
  await page.screenshot({path:'/tmp/ganh-reply-simple-desktop.png',fullPage:true});
  await clickText('Duyệt & sao chép');
  await page.waitForSelector('.gr-message');
  assert.ok((await page.$eval('.gr-message',e=>e.textContent)).includes('Đã lưu và sao chép.'),await page.$eval('.gr-message',e=>e.textContent));
  assert.equal(await page.evaluate(()=>window.__actions.filter(x=>x.action==='save').length),1);
  assert.equal(await page.evaluate(()=>window.__actions.find(x=>x.action==='save').body.approve),true);
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.$eval('textarea[aria-label="Câu trả lời"]',e=>e.value));
  await clickText('Sao chép câu trả lời');
  await page.waitForFunction(()=>window.__actions.filter(x=>x.action==='copy').length===2);
  assert.equal(await page.evaluate(()=>window.__actions.filter(x=>x.action==='save').length),1,'Repeat copy must not add a revision');
  await clickText('Viết lại');
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Câu trả lời"]')?.value.startsWith('Bản viết lại'));
  assert.ok(await page.evaluate(()=>window.__actions.find(x=>x.action==='rewrite').body.reason.length>0));
  await clickText('Lịch sử');
  await page.waitForFunction(()=>document.body.innerText.includes('1 phản hồi trong phạm vi quyền'));
  await clickText('Mở');await page.waitForSelector('.gr-reply-card');
  await page.$eval('.gr-alternatives summary',e=>e.click());
  assert.equal(await page.$$eval('.gr-options button',e=>e.length),3);
  await page.click('.gr-options button:first-child');
  assert.equal(await page.$eval('textarea[aria-label="Câu trả lời"]',e=>e.value.startsWith('Bạn đang nhắc')),true);
  await page.setViewport({width:393,height:852});
  await page.$eval('.gr-alternatives summary',e=>e.click());
  await page.screenshot({path:'/tmp/ganh-reply-simple-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile overflow');
  await clickText('Kiến thức Gánh');await page.waitForFunction(()=>document.body.innerText.includes('Chưa có tài liệu'));
  await clickText('Thống kê');await page.waitForFunction(()=>document.body.innerText.includes('Chưa có dữ liệu trong 30 ngày'));

  await start('staff-sensitive');
  await clickText('Gửi quản lý duyệt');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã gửi quản lý duyệt.'));
  assert.equal(await page.evaluate(()=>window.__actions.some(x=>x.action==='copy')),false,'Sensitive Staff flow must not copy');
  assert.equal(await page.evaluate(()=>window.__actions.find(x=>x.action==='save').body.approve),false);
  assert.equal(await page.$eval('.gr-primary-actions button',e=>e.disabled),true,'Submitted unchanged version cannot be submitted twice');

  await start('staff');await clickText('Lưu & sao chép');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã lưu và sao chép.'));
  assert.equal(await page.evaluate(()=>window.__actions.find(x=>x.action==='save').body.approve),false);
  await start('sensitive-admin');await clickText('Duyệt & sao chép');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã lưu và sao chép.'));
  assert.equal(await page.evaluate(()=>window.__actions.find(x=>x.action==='save').body.approve),true);
  await start('approval-mismatch');await clickText('Duyệt & sao chép');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã gửi quản lý duyệt.'));
  assert.equal(await page.evaluate(()=>window.__actions.some(x=>x.action==='copy')),false,'Stale approval cannot be copied');
  await start('clipboard-denied');await clickText('Duyệt & sao chép');
  await page.waitForFunction(()=>document.body.innerText.includes('Trình duyệt chưa cho sao chép'));
  await clickText('Sao chép câu trả lời');
  await page.waitForFunction(()=>document.body.innerText.includes('Đã lưu và sao chép.'));
  assert.equal(await page.evaluate(()=>window.__actions.filter(x=>x.action==='save').length),1,'Clipboard retry preserves the saved approval');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Simplified UI checks passed: recommended reply, save/approve+copy, repeat copy, one-click rewrite, alternatives, history, desktop/mobile, sensitive Staff/Admin and stale approval.');
} finally {if(browser)await browser.close();await unlink(fixturePath).catch(()=>{});}
