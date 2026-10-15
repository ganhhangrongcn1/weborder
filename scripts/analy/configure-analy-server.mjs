import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

export async function setAnalySecrets(values) {
  const pipe = `\\\\.\\pipe\\ghr-analy-secrets-${randomUUID()}`;
  let envText = Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(String(value))}`).join('\n') + '\n';
  const bridge = net.createServer(socket => socket.end(envText));
  await new Promise((resolve, reject) => { bridge.once('error', reject); bridge.listen(pipe, resolve); });
  try {
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `supabase.cmd secrets set --project-ref qjaklysckgzdfjthzkzu --env-file ${pipe}`], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.resume(); child.stderr.resume();
    const timeout = setTimeout(() => child.kill(), 30000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    clearTimeout(timeout);
    return code === 0;
  } finally { envText = ''; bridge.close(); }
}
if (process.argv.includes('--pipe-check')) {
  console.log(JSON.stringify({ securePipeSupported: await setAnalySecrets({ ANALY_DEVICE_ID: 'ghr-analy-qjaklysckgzdfjthzkzu' }) }));
}
if (process.argv.includes('--configure')) {
  let input = '';
  let values;
  try {
    for await (const chunk of process.stdin) input += chunk;
    values = JSON.parse(input.replace(/^\uFEFF/, '')); input = '';
    if (!values.username?.trim() || !values.password || !values.serverKey?.startsWith('eyJ')) throw new Error('invalid_input');
    const configured = await setAnalySecrets({
      ANALY_USERNAME: values.username.trim(), ANALY_PASSWORD: values.password,
      ANALY_DEVICE_ID: 'ghr-analy-qjaklysckgzdfjthzkzu', ANALY_ACCOUNT_MODE: 'trial_7_days',
      ANALY_SERVER_KEY_SHA256: createHash('sha256').update(values.serverKey).digest('hex'),
    });
    values.password = undefined;
    if (!configured) throw new Error('secret_update_failed');
    console.log('Đã lưu tài khoản trong Supabase Secrets. Đang kiểm tra kết nối…');
    const report = { checkedAt: new Date().toISOString(), credentialsStoredInSupabase: true, deliveriesCreated: 0, steps: [] };
    for (const action of ['connect', 'check_api', 'status']) {
      const response = await fetch('https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/analy-session', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(75000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${values.serverKey}`, apikey: values.serverKey, 'x-analy-server-key': values.serverKey },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      report.steps.push({ action, status: response.status, result });
      console.log(JSON.stringify({ action, status: response.status, ...result }, null, 2));
      if (response.status !== 200 || result.ok === false) break;
    }
    const connected = report.steps.find(step => step.action === 'connect')?.result;
    const status = report.steps.find(step => step.action === 'status')?.result;
    report.cachedSessionReused = !!connected?.session_updated_at && connected.session_updated_at === status?.session_updated_at;
    await mkdir(new URL('../../tmp/', import.meta.url), { recursive: true });
    await writeFile(new URL('../../tmp/analy-server-setup-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
  } catch { console.error('Cấu hình hoặc kiểm tra chưa hoàn tất. Không in thông tin nhạy cảm; không tự thử lại.'); process.exitCode = 1; }
  finally { input = ''; values = undefined; }
}
