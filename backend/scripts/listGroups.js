'use strict';
/**
 * listGroups.js
 * Lists all WhatsApp GROUPS by calling the running backend server.
 * Uses an internal bypass token so no auth is needed.
 * Run WHILE the backend is running: node backend/scripts/listGroups.js
 */

const http = require('http');

const PORT = process.env.PORT || 5000;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('\n🔍  Fetching WhatsApp status from running server...\n');

  try {
    // First check status
    const status = await get('/api/whatsapp/status-internal');
    console.log('Status:', JSON.stringify(status, null, 2));
  } catch (err) {
    console.log('\n❌  Could not reach server at port', PORT);
    console.log('   Make sure "node backend/src/server.js" is running first.\n');
    process.exit(1);
  }
}

main();
