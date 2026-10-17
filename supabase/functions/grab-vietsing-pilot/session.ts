import { CookieJar } from 'npm:tough-cookie@6.0.0';

export async function restoreSession(raw) {
  const session = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
  if (session.cookieJar) return { session, jar: await CookieJar.deserialize(session.cookieJar) };
  const jar = new CookieJar();
  for (const cookie of session.cookies || []) {
    const domain = String(cookie.domain || '').replace(/^\./, '');
    if (!domain || !cookie.name) continue;
    await jar.setCookie([
      `${cookie.name}=${cookie.value}`, `Path=${cookie.path || '/'}`,
      String(cookie.domain).startsWith('.') ? `Domain=${domain}` : '',
      cookie.secure ? 'Secure' : '', cookie.httpOnly ? 'HttpOnly' : '',
      cookie.expires > 0 ? `Expires=${new Date(cookie.expires * 1000).toUTCString()}` : ''
    ].filter(Boolean).join('; '), `https://${domain}${cookie.path || '/'}`);
  }
  return { session, jar };
}

export async function serializeSession(jar, previous = {}) {
  const serialized = await jar.serialize();
  const cookies = (serialized.cookies || []).map(cookie => ({
    name: cookie.key, value: cookie.value,
    domain: cookie.hostOnly ? cookie.domain : `.${cookie.domain}`,
    path: cookie.path || '/', secure: Boolean(cookie.secure), httpOnly: Boolean(cookie.httpOnly),
    expires: cookie.expires && cookie.expires !== 'Infinity'
      ? Math.floor(Date.parse(cookie.expires) / 1000) : -1
  }));
  return { cookies, cookieJar: serialized, storage: previous.storage || {} };
}

// A clean-cookie login test never deletes or revokes the existing working session.
// If Grab demands Hydra/OTP/security verification, stop after that response.
export async function loginWithoutBrowser(credentials, requestFetch = fetch) {
  const jar = new CookieJar();
  const request = async (url, body) => {
    const response = await requestFetch(url, {
      method: body ? 'POST' : 'GET', redirect: 'manual',
      headers: {
        accept: 'application/json, text/plain, */*',
        origin: 'https://weblogin.grab.com', referer: 'https://weblogin.grab.com/',
        cookie: await jar.getCookieString(url),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000)
    });
    for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, url);
    return response;
  };
  const loginUrl = 'https://api.grab.com/grabid/v1/authnv4/login';
  const loginBody = {
    challengeSessionID: '', accountIdentifier: credentials.username,
    accountIdentifierType: 'USERNAME', serviceID: 'MEXUSERS',
    redirect: 'https://merchant.grab.com/portal'
  };
  const first = await request(loginUrl, loginBody);
  const challenge = await first.json().catch(() => ({}));
  const challengeSessionID = challenge.details?.challengeSessionID;
  const challengeType = challenge.details?.currentGeneratedChallenge?.challengeType;
  if (!first.ok || !challengeSessionID || challengeType !== 'PWD_V2') {
    return { ok: false, stage: 'challenge', status: first.status,
      code: first.status === 429 ? 'GRAB_RATE_LIMITED' : 'GRAB_BROWSER_OR_INTERACTIVE_AUTH_REQUIRED' };
  }
  const verified = await request('https://api.grab.com/grabid/v1/challengesession/challengeSession/verifyChallenge', {
    challengeSessionID, challengeType, payload: { code: credentials.password }
  });
  const result = await verified.json().catch(() => ({}));
  if (!verified.ok || result.isCompleted !== true) {
    return {ok:false,stage:'password',status:verified.status,code:'GRAB_LOGIN_NOT_COMPLETED'};
  }
  const completed = await request(loginUrl, {...loginBody,challengeSessionID});
  const completion = await completed.json().catch(() => ({}));
  if (!completed.ok || !completion.redirect) {
    return {ok:false,stage:'completion',status:completed.status,code:'GRAB_LOGIN_NOT_COMPLETED'};
  }
  let url = completion.redirect;
  for (let count=0; count<10; count++) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !['api.grab.com','merchant.grab.com','weblogin.grab.com'].includes(target.hostname)) {
      throw new Error('GRAB_REDIRECT_REJECTED');
    }
    const response = await request(url);
    if (response.status < 300 || response.status >= 400) return {ok:true,jar,stage:'completed',status:response.status};
    const location = response.headers.get('location');
    if (!location) throw new Error('GRAB_REDIRECT_MISSING');
    url = new URL(location,url).href;
  }
  throw new Error('GRAB_REDIRECT_LIMIT');
}
