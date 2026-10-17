export function safeGrabMessage(value, credentials = {}) {
  let result = String(value || '');
  for (const secret of [credentials.password,credentials.username]) {
    if (secret) result = result.split(secret).join('[redacted]');
  }
  return result.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
    .replace(/[A-Za-z0-9_+/=-]{24,}/g,'[token]').slice(0,350);
}

export function loginResponseDiagnostic(url, status, body, requestBody, credentials) {
  const path = new URL(url).pathname;
  const code = body?.code ?? body?.errorCode ?? body?.error?.code ?? null;
  return {
    path,status,
    code:typeof code === 'number' ? code : typeof code === 'string'
      ? safeGrabMessage(code,credentials).slice(0,64) : null,
    message:safeGrabMessage(body?.message || body?.error?.message,credentials),
    challenge_type:String(body?.details?.currentGeneratedChallenge?.challengeType || '').slice(0,40),
    response_has_challenge_session:Boolean(body?.details?.challengeSessionID),
    completed:body?.isCompleted === true,
    request_fields:Object.keys(requestBody || {}).filter(key=>/^[A-Za-z_]+$/.test(key)).slice(0,20),
    has_challenge_session:Boolean(requestBody?.challengeSessionID),
    request_challenge_type:String(requestBody?.challengeType || '').slice(0,40)
  };
}

export function isCriticalLoginPath(url) {
  const path = new URL(url).pathname;
  return path === '/grabid/v1/authnv4/login'
    || path === '/grabid/v1/challengesession/challengeSession/verifyChallenge';
}

// One diagnostic run is allowed for the old, uninstrumented HTTP 400 result.
// This never bypasses a 429, permission denial, OTP or an already-recorded diagnosis.
export function allowLegacy400Diagnostic(previous, now = Date.now()) {
  const network = previous?.auth?.diagnostics?.network || [];
  const revision = previous?.auth?.diagnostics?.revision;
  const detachedInput = revision === 5 && previous.auth.stage === 'password'
    && previous.auth.diagnostics.client_error === 'Node is detached from document';
  const unsentPassword = ([1,2,3,4].includes(revision) || detachedInput)
    && previous.auth.diagnostics.password_submitted !== true
    && network.length === 1
    && network[0].path === '/grabid/v1/authnv4/login'
    && network[0].status === 400 && network[0].challenge_type === 'PWD_V2';
  const legacy = previous?.auth?.status === 400
    && previous.auth.code === 'GRAB_BROWSER_LOGIN_INCOMPLETE'
    && !previous.auth.diagnostics?.revision;
  const knownUnsent = unsentPassword
    && [undefined,400].includes(previous?.auth?.status)
    && ['GRAB_BROWSER_LOGIN_INCOMPLETE','BROWSERLESS_LOGIN_FAILED'].includes(previous?.auth?.code);
  return (legacy || knownUnsent)
    && now-Date.parse(previous.at || '') >= 60_000;
}
