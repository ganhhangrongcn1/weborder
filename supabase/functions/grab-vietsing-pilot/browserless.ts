import { restoreSession } from './session.ts';
import {safeGrabMessage,loginResponseDiagnostic,isCriticalLoginPath} from './diagnostics.ts';

const LOGIN_URL = 'https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal';
const USERNAME = "input[name='username'], input[autocomplete='username'], input[type='text']";
const PASSWORD = "input[type='password']:not([disabled])";

export function browserlessEndpoint(token) {
  if (!String(token || '').trim()) throw new Error('BROWSERLESS_NOT_CONFIGURED');
  // Fixed standard Chrome endpoint. No proxy, stealth, paid upgrades or CAPTCHA solver.
  const url = new URL('wss://production-sfo.browserless.io/');
  url.searchParams.set('token',token);
  url.searchParams.set('timeout','90000');
  return url.href;
}

export function classifyBrowserLogin(status, pageText = '') {
  if (status === 429) return 'GRAB_RATE_LIMITED';
  if (status === 401 || status === 403) return 'GRAB_LOGIN_REJECTED';
  if (/captcha|verification code|one[- ]time password|\botp\b|mã xác minh|mã xác thực/i.test(pageText)) {
    return 'GRAB_INTERACTIVE_AUTH_REQUIRED';
  }
  return 'GRAB_BROWSER_LOGIN_INCOMPLETE';
}

export default async function loginWithBrowserless(credentials, token, options = {}) {
  const endpoint = browserlessEndpoint(token);
  if (!credentials?.username || !credentials?.password) throw new Error('GRAB_CREDENTIALS_MISSING');
  let browser;
  let context;
  let timer;
  let loginStatus = 0;
  const network = [];
  const pending = [];
  const diagnostics = {revision:6,network,password_submitted:false};
  let stage = 'connect';
  const connect = options.connect || (async config => {
    // Lazy import keeps the existing API-only cron independent from browser dependencies.
    stage = 'load_library';
    const {default:puppeteer} = await import('npm:puppeteer-core@25.4.0/lib/puppeteer/puppeteer-core-browser.js');
    const {BrowserWebSocketTransport} = await import('npm:puppeteer-core@25.4.0/internal/common/BrowserWebSocketTransport.js');
    stage = 'connect';
    // Supabase provides native WebSocket; do not select Puppeteer's Node ws adapter.
    const transport = await BrowserWebSocketTransport.create(config.browserWSEndpoint);
    return puppeteer.connect({transport,protocolTimeout:config.protocolTimeout});
  });
  const run = async () => {
    browser = await connect({browserWSEndpoint:endpoint,protocolTimeout:10_000});
    // A new context proves login without sharing the saved session.
    stage = 'create_context';
    context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('response',response => {
      if (!response.url().startsWith('https://api.grab.com/grabid/') || network.length >= 12) return;
      const request = response.request();
      if (request.method() !== 'POST') return;
      // Do not confuse anonymous profile/telemetry errors with password verification.
      pending.push((async()=>{
        const body = await response.json().catch(()=>({}));
        // Grab uses HTTP 400 with PWD_V2 to request the next login step.
        const passwordChallenge = new URL(response.url()).pathname === '/grabid/v1/authnv4/login'
          && body?.details?.currentGeneratedChallenge?.challengeType === 'PWD_V2'
          && Boolean(body?.details?.challengeSessionID);
        if (isCriticalLoginPath(response.url()) && response.status() >= 400 && !passwordChallenge) {
          loginStatus = response.status();
        }
        let requestBody = {};
        try {requestBody = JSON.parse(request.postData() || '{}');} catch { /* keys only */ }
        network.push(loginResponseDiagnostic(response.url(),response.status(),body,requestBody,credentials));
      })());
    });
    stage = 'open_login';
    await page.goto(LOGIN_URL,{waitUntil:'domcontentloaded',timeout:25_000});
    const username = await page.waitForSelector(USERNAME,{visible:true});
    stage = 'username';
    await username.type(credentials.username,{delay:10});
    await username.press('Enter');
    const password = await page.waitForSelector(PASSWORD,{visible:true}).catch(()=>null);
    if (!password || loginStatus) {
      await Promise.allSettled(pending);
      const text = await page.evaluate(()=>document.body?.innerText || '').catch(()=>'');
      diagnostics.page_message = safeGrabMessage(text,credentials);
      return {ok:false,stage:'username',status:loginStatus,code:classifyBrowserLogin(loginStatus,text),diagnostics};
    }
    stage = 'password';
    // Grab can replace the input during challenge initialization. A locator
    // reacquires the live element instead of typing into a detached handle.
    await page.locator(PASSWORD).fill(credentials.password);
    // The Grab password screen's Continue button is not reliably submitted by Enter.
    stage = 'find_continue';
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(element=>
      element.textContent?.trim()==='Continue' && !element.disabled
      && element.getClientRects().length>0),{timeout:8000}).catch(()=>null);
    diagnostics.form = await page.evaluate(()=>({
      password_present:Boolean(document.querySelector('input[type="password"]')?.value),
      inputs:Array.from(document.querySelectorAll('input')).map(element=>({
        type:element.type,id:element.id,name:element.name,filled:Boolean(element.value),
        visible:element.getClientRects().length>0
      })).slice(0,8),
      buttons:Array.from(document.querySelectorAll('button')).map(element=>({
        text:element.textContent?.trim().slice(0,40),disabled:element.disabled,
        visible:element.getClientRects().length>0
      })).slice(0,8)
    }));
    const buttons = await page.$$('button');
    let continueButton;
    for (const button of buttons) {
      if (await button.evaluate(element=>element.textContent?.trim()==='Continue'
        && !element.disabled && element.getClientRects().length>0)) {
        continueButton=button;
        break;
      }
    }
    if (!continueButton) throw new Error('GRAB_CONTINUE_BUTTON_UNAVAILABLE');
    stage = 'submit_password';
    diagnostics.password_submitted=true;
    await Promise.all([
      page.waitForNavigation({waitUntil:'domcontentloaded',timeout:25_000}).catch(()=>null),
      continueButton.click()
    ]);
    await Promise.allSettled(pending);
    const cookies = await context.cookies();
    if (!cookies.some(cookie=>cookie.name==='mexusers_authn_token')) {
      const text = await page.evaluate(()=>document.body?.innerText || '').catch(()=>'');
      diagnostics.page_message = safeGrabMessage(text,credentials);
      return {ok:false,stage:'password',status:loginStatus,code:classifyBrowserLogin(loginStatus,text),diagnostics};
    }
    const {jar} = await restoreSession({cookies});
    return {ok:true,stage:'browserless_fresh_session',jar,diagnostics};
  };
  try {
    return await Promise.race([
      run(),
      new Promise((_,reject)=>{
        timer = setTimeout(()=>reject(new Error('BROWSERLESS_TRIAL_TIMEOUT')),85_000);
      })
    ]);
  } catch (error) {
    // Browser connection errors can contain the token URL. Never expose their text.
    const code = error?.message === 'BROWSERLESS_TRIAL_TIMEOUT'
      ? 'BROWSERLESS_TRIAL_TIMEOUT' : 'BROWSERLESS_LOGIN_FAILED';
    const details = String(error?.message || '');
    const reason = /ws does not work in the browser|not supported|not implemented/i.test(details)
      ? 'RUNTIME_TRANSPORT_UNSUPPORTED'
      : /401|unauthorized/i.test(details) ? 'BROWSERLESS_UNAUTHORIZED'
      : /403|forbidden/i.test(details) ? 'BROWSERLESS_FORBIDDEN'
      : /429|too many/i.test(details) ? 'BROWSERLESS_RATE_LIMITED'
      : /timeout|timed out/i.test(details) ? 'CONNECTION_TIMEOUT' : 'CONNECTION_OR_RUNTIME_ERROR';
    diagnostics.client_error = safeGrabMessage(details.split(token).join('[redacted]'),credentials);
    return {ok:false,stage,code,reason,diagnostics};
  } finally {
    clearTimeout(timer);
    await context?.close().catch(()=>{});
    await browser?.close().catch(()=>browser?.disconnect());
  }
}
