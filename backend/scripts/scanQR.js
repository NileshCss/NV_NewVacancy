'use strict';

/**
 * scanQR.js
 * Generates a WhatsApp QR code as a LARGE, clear HTML page
 * that opens automatically in your browser for easy scanning.
 *
 * Usage:
 *   cd e:\new-vacancy
 *   node backend/scripts/scanQR.js
 *
 * Then:
 *   1. The browser opens with a big, clear QR code
 *   2. Open WhatsApp on your phone
 *   3. Go to  ⋮  →  Linked Devices  →  Link a Device
 *   4. Scan the QR code shown in the browser
 *   5. Wait for "✅ Authenticated!" message in terminal
 *   6. Done — session saved, you won't need to scan again
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.WHATSAPP_ENABLED = 'true'; // force-enable for this script

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode  = require('qrcode');
const fs      = require('fs');
const path    = require('path');
const { exec } = require('child_process');
const puppeteerPkg = (() => { try { return require('puppeteer'); } catch { return null; } })();

// ── Config ────────────────────────────────────────────────────────────────────
const AUTH_PATH  = process.env.WHATSAPP_AUTH_PATH || path.join(__dirname, '../../.wwebjs_auth');
const QR_FILE    = path.join(__dirname, '../../qr-scan.html');

// ── Open browser cross-platform ───────────────────────────────────────────────
function openBrowser(url) {
  const cmd = process.platform === 'win32'  ? `start "" "${url}"` :
              process.platform === 'darwin' ? `open "${url}"`     : `xdg-open "${url}"`;
  exec(cmd, err => { if (err) console.log(`\n👆 Open this file manually:\n   ${url}\n`); });
}

// ── Generate HTML page with big QR code ──────────────────────────────────────
async function writeQRPage(qrData, status = 'Scan with WhatsApp') {
  const dataURL = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',
    type:    'image/png',
    width:   400,
    margin:  2,
    color:   { dark: '#000000', light: '#ffffff' },
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>WhatsApp QR — NewVacancy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #e2e8f0;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
      max-width: 520px;
      width: 90%;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #f97316;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 28px;
    }
    .qr-wrap {
      background: #ffffff;
      border-radius: 16px;
      padding: 20px;
      display: inline-block;
      margin-bottom: 28px;
    }
    .qr-wrap img {
      display: block;
      width: 340px;
      height: 340px;
    }
    .status {
      font-size: 14px;
      font-weight: 600;
      color: #fbbf24;
      background: rgba(251,191,36,0.1);
      border: 1px solid rgba(251,191,36,0.25);
      border-radius: 10px;
      padding: 10px 18px;
      margin-bottom: 24px;
    }
    .steps {
      text-align: left;
      background: rgba(249,115,22,0.05);
      border: 1px solid rgba(249,115,22,0.15);
      border-radius: 14px;
      padding: 18px 22px;
    }
    .steps h3 {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #f97316;
      margin-bottom: 12px;
    }
    .steps ol {
      padding-left: 18px;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 2;
    }
    .note {
      margin-top: 16px;
      font-size: 11px;
      color: #475569;
    }
    .refresh-hint {
      margin-top: 20px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
  <script>
    // Auto-refresh page every 25 seconds so QR stays fresh
    // (WhatsApp QR codes expire after ~20-30 seconds)
    setTimeout(() => location.reload(), 25000);
  </script>
</head>
<body>
  <div class="card">
    <div class="logo">📱</div>
    <h1>NewVacancy WhatsApp Login</h1>
    <p class="subtitle">Scan this QR code to connect your WhatsApp account</p>

    <div class="qr-wrap">
      <img src="${dataURL}" alt="WhatsApp QR Code" />
    </div>

    <div class="status">⏳ ${status}</div>

    <div class="steps">
      <h3>How to scan</h3>
      <ol>
        <li>Open <strong>WhatsApp</strong> on your phone</li>
        <li>Tap <strong>⋮ (3 dots)</strong> in the top-right</li>
        <li>Tap <strong>"Linked Devices"</strong></li>
        <li>Tap <strong>"Link a Device"</strong></li>
        <li>Point your camera at the QR code above</li>
      </ol>
    </div>

    <p class="note">⚡ Session is saved after scanning — you won't need to scan again.</p>
    <p class="refresh-hint">Page auto-refreshes every 25 s • Generated: ${new Date().toLocaleTimeString()}</p>
  </div>
</body>
</html>`;

  fs.writeFileSync(QR_FILE, html, 'utf8');
  return QR_FILE;
}

// ── Write "authenticated" success page ────────────────────────────────────────
function writeSuccessPage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WhatsApp Connected — NewVacancy</title>
  <style>
    body { min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#0f172a; font-family:-apple-system,sans-serif; color:#e2e8f0; }
    .card { background:#1e293b; border:1px solid #334155; border-radius:24px; padding:48px;
            text-align:center; max-width:440px; width:90%; }
    .icon { font-size:72px; margin-bottom:16px; }
    h1 { font-size:24px; font-weight:800; color:#22c55e; margin-bottom:8px; }
    p { color:#94a3b8; font-size:14px; line-height:1.7; }
    .badge { margin-top:20px; display:inline-block; background:rgba(34,197,94,.1);
             border:1px solid rgba(34,197,94,.25); border-radius:10px;
             padding:8px 16px; font-size:13px; color:#22c55e; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>WhatsApp Connected!</h1>
    <p>Your WhatsApp account is linked.<br>
       The session is saved — you won't need to scan again.</p>
    <div class="badge">📱 NewVacancy Bot is ready</div>
    <p style="margin-top:20px;font-size:12px;color:#475569;">
      You can close this window and the terminal.<br>
      Now run: <code>npm run get-chats</code> to find your group ID.
    </p>
  </div>
</body>
</html>`;
  fs.writeFileSync(QR_FILE, html, 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📱  WhatsApp QR Code Generator');
  console.log('━'.repeat(50));
  console.log('   Starting WhatsApp client…\n');

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'newvacancy-bot',
      dataPath:  AUTH_PATH,
    }),
    puppeteer: {
      headless:        true,
      executablePath:  puppeteerPkg ? puppeteerPkg.executablePath() : undefined,
      protocolTimeout: 120000,   // 2 min — fixes "Runtime.callFunctionOn timed out"
      timeout:         120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-background-networking',
      ],
    },
    authTimeoutMs: 120000,
  });

  let browserOpened = false;

  client.on('qr', async (qr) => {
    console.log('🔄  QR received — generating browser page…');
    const filePath = await writeQRPage(qr);

    if (!browserOpened) {
      browserOpened = true;
      console.log(`\n✅  QR page created: ${filePath}`);
      console.log('🌐  Opening in your browser…\n');
      openBrowser(filePath);
    } else {
      console.log('🔄  QR refreshed (previous one expired)');
    }

    console.log('👆  Scan the QR code shown in your browser with WhatsApp\n');
  });

  client.on('authenticated', () => {
    console.log('\n✅  WhatsApp authenticated successfully!');
    console.log('💾  Session saved — you won\'t need to scan again.\n');
    writeSuccessPage();
  });

  client.on('auth_failure', (msg) => {
    console.error('\n❌  Auth failed:', msg);
    console.log('   Delete the .wwebjs_auth folder and try again.\n');
    process.exit(1);
  });

  client.on('ready', async () => {
    const info = client.info;
    console.log('━'.repeat(50));
    console.log(`🚀  WhatsApp READY!`);
    if (info) {
      console.log(`📱  Connected: ${info.pushname} (+${info.wid.user})`);
    }
    console.log('━'.repeat(50));
    console.log('\n📋  Next step — find your group ID:');
    console.log('   node backend/scripts/getChats.js\n');
    await client.destroy();
    process.exit(0);
  });

  await client.initialize();
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  process.exit(1);
});
