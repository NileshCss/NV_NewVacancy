'use strict';

/**
 * getChats.js
 * Helper script to discover your WhatsApp group/channel ID.
 *
 * Usage:
 *   cd backend
 *   node scripts/getChats.js
 *
 * Prerequisites: WhatsApp must already be authenticated (session in .wwebjs_auth/).
 * If not yet authenticated, the QR code will print — scan it first.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Override WHATSAPP_ENABLED so the service initialises regardless of .env
process.env.WHATSAPP_ENABLED = 'true';

const whatsappService = require('../src/services/whatsappService');

const TIMEOUT_MS = 2 * 60 * 1000;  // 2 minutes max wait

async function main() {
  console.log('\n🔍  Connecting to WhatsApp…\n');

  await whatsappService.initialize();

  // ── Poll until ready ────────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const start    = Date.now();
    const interval = setInterval(() => {
      if (whatsappService.isReady) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > TIMEOUT_MS) {
        clearInterval(interval);
        reject(new Error('Timed out waiting for WhatsApp to be ready'));
      }
    }, 1000);
  });

  // ── Fetch chats ─────────────────────────────────────────────────────────────
  const chats = await whatsappService.getAllChats();

  const groups   = chats.filter(c => c.isGroup);
  const personal = chats.filter(c => !c.isGroup);

  console.log('\n' + '═'.repeat(70));
  console.log(`  Found ${chats.length} chats  (${groups.length} groups, ${personal.length} individual)\n`);

  if (groups.length > 0) {
    console.log('📋  GROUPS:\n');
    groups.forEach((g, i) => {
      console.log(`  ${i + 1}. ${g.name}`);
      console.log(`     ID: ${g.id}`);
      console.log(`     Unread: ${g.unread}`);
      console.log('');
    });
  }

  console.log('═'.repeat(70));
  console.log('\n✅  Copy the group ID above and paste it in backend/.env:\n');
  console.log('   WHATSAPP_GROUP_ID=<paste ID here>\n');
  console.log('   Then set WHATSAPP_ENABLED=true and restart the server.\n');

  await whatsappService.destroy();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Error:', err.message, '\n');
  process.exit(1);
});
