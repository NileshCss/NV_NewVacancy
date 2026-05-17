const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTU4MTcsImV4cCI6MjA5MDA5MTgxN30.tGcOp2wAToFR5z7G0yAovHAveoq_84X6iprZ7R_3cnE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function loginAdmin() {
  // Use the admin user we just checked
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'rajputnileshsingh25@gmail.com', // wait, I still don't know the password
    password: 'Password123'
  })
}

// Just try to test if is_admin is hanging by inserting a job that doesn't exist
// We can use the service key to bypass auth but we want to simulate RLS, so anon key will hang if RLS hangs, right?
// Actually if we insert as anon, is_admin() runs, auth.uid() is null, so it selects where id = null.
// Let's see if it hangs.
async function testInsert() {
  const t0 = Date.now()
  const { data, error } = await supabase.from('jobs').insert({
    title: 'Test Job',
    organization: 'Test Org',
    category: 'govt'
  })
  console.log('Query took:', Date.now() - t0, 'ms')
  console.log('Data:', data, 'Error:', error)
}

testInsert()
