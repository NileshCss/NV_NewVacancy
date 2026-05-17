const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTU4MTcsImV4cCI6MjA5MDA5MTgxN30.tGcOp2wAToFR5z7G0yAovHAveoq_84X6iprZ7R_3cnE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testRpc() {
  const { data, error } = await supabase.rpc('super_admin_promote_user', { target_user_id: '173d168c-682e-46ac-844f-154bb5cb42b6' })
  console.log('Result:', data)
  console.log('Error:', error)
}

testRpc()
