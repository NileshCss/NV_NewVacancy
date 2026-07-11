/**
 * run_subscription_migration.js
 * Applies the subscription system SQL migration directly using Supabase exec_sql.
 */
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: require('path').join(__dirname, 'backend/.env') })

const SUPABASE_URL = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.trim() : ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function runMigration() {
  console.log('🚀 Reading subscription_system.sql...')
  const sqlPath = path.join(__dirname, 'subscription_system.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('SUPABASE_URL:', SUPABASE_URL)
  console.log('SUPABASE_SERVICE_KEY length:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 0)
  console.log('SUPABASE_SERVICE_KEY start:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.slice(0, 10) : 'none')

  console.log('⏳ Executing migration on Supabase...')
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    if (error) throw error
    console.log('🎉 Subscription system database migration applied successfully!')
    console.log('Data returned:', data)
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    console.log('Checking if we need to run statement-by-statement or if there is a syntax issue.')
  }
}

runMigration()
