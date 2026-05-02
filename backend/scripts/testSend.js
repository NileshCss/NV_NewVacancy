'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const whatsapp = require('../src/services/whatsappService');

async function main() {
  console.log('\n🧪 WhatsApp Direct Send Test\n');

  // Wait for client to be ready (max 40s)
  let waited = 0;
  while (!whatsapp.isReady && waited < 40000) {
    await new Promise(r => setTimeout(r, 1000));
    waited += 1000;
    process.stdout.write('.');
  }

  if (!whatsapp.isReady) {
    console.log('\n❌ Client not ready after 40s');
    process.exit(1);
  }

  console.log('\n✅ Client is ready! Sending test message...\n');

  const msg = `🧪 *WhatsApp Bot Test*\n\nThis is a connectivity test from *NewVacancy* server.\n✅ Fix applied — notifications should now work!\n\n_Sent at: ${new Date().toLocaleString('en-IN')}_`;

  const result = await whatsapp.sendToGroup(msg);
  console.log('\nResult:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅✅ SUCCESS — Message delivered to group!');
  } else {
    console.log('\n❌ FAILED:', result.reason || result.error);
  }

  await whatsapp.destroy();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
