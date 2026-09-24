// DRH email — spawn Windows PowerShell smtp.ps1 via -EncodedCommand (no quoting issues).
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const PS1 = path.join(__dirname, 'smtp.ps1');
const b64u = (t) => Buffer.from(String(t), 'utf8').toString('base64');

function sendEmail(conf) {
  return new Promise((resolve) => {
    if (!fs.existsSync(PS1)) return resolve({ success: false, error: 'smtp.ps1 introuvable' });
    const env = Object.assign({}, process.env, {
      DRH_SMTP_HOST: conf.host || 'smtp.gmail.com',
      DRH_SMTP_PORT: String(conf.port || 587),
      DRH_SMTP_SECURE: conf.secure ? 'true' : 'false',
      DRH_SMTP_USER: conf.user || '',
      DRH_SMTP_PASS: conf.pass || '',
      DRH_MAIL_FROM: b64u(conf.from || ''),
      DRH_MAIL_TO: b64u((Array.isArray(conf.to) ? conf.to : [conf.to]).join(';')),
      DRH_MAIL_SUBJECT: b64u(conf.subject || ''),
      DRH_MAIL_HTML: b64u(conf.html || ''),
      DRH_MAIL_FILES: (conf.files || []).join(';'),
    });
    const script = fs.readFileSync(PS1, 'utf8');
    const enc = Buffer.from('\uFEFF' + script, 'utf16le').toString('base64');
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { env, windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => resolve({ success: false, error: String((e && e.message) || e) }));
    child.on('close', () => {
      const combined = out + '\n' + err;
      if (/SEND_OK/.test(combined)) return resolve({ success: true });
      const m = /SEND_ERR:\s*([\s\S]*)/.exec(combined);
      const clean = (m ? m[1] : combined).replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\u00C0-\u00FF\n]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
      resolve({ success: false, error: clean || 'SMTP error' });
    });
  });
}

module.exports = { sendEmail };
