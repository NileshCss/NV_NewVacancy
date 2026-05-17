const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTU4MTcsImV4cCI6MjA5MDA5MTgxN30.tGcOp2wAToFR5z7G0yAovHAveoq_84X6iprZ7R_3cnE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function loginAdmin() {
  // Use the admin user we just checked
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'rajputnileshsingh25@gmail.com',
    password: 'Password123' // assuming this is what they changed it to or something... Wait, I don't know the password
  })
}

// Just try to test if is_admin is hanging by selecting a job that doesn't exist
async function testIsAdmin() {
  const t0 = Date.now()
  const { data, error } = await supabase.from('jobs').select('*').limit(1)
  console.log('Query took:', Date.now() - t0, 'ms')
  console.log('Data:', data ? data.length : 0, 'Error:', error)
}

testIsAdmin()
