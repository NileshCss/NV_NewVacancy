/**
 * run_student_mock_tests_migration.js
 * Applies the student mock tests database migration using Supabase RPC exec_sql with hardcoded credentials.
 */
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNTgxNywiZXhwIjoyMDkwMDkxODE3fQ.FMnx4vyN4fvQkFj7jCdAKRQqzq3kLvCuH9MbKZkMx2g'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function runMigration() {
  console.log('🚀 Reading 026_student_mock_tests_attempts.sql...')
  const sqlPath = path.join(__dirname, 'backend/supabase/migrations/026_student_mock_tests_attempts.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('⏳ Executing migration on Supabase...')
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    if (error) throw error
    console.log('🎉 Student mock tests database migration applied successfully!')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
  }
}

runMigration()
