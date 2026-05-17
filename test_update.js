const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTU4MTcsImV4cCI6MjA5MDA5MTgxN30.tGcOp2wAToFR5z7G0yAovHAveoq_84X6iprZ7R_3cnE'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // We need a real user context, so let's use ANON key and a test user session

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testUpdate() {
  // Try to login as a user to get a session
  // Since we don't have the password, we can just try to update anonymously to see if it hangs or returns an error immediately
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: 'Test' })
    .eq('id', '173d168c-682e-46ac-844f-154bb5cb42b6')
    
  console.log('Update result:', data, error)
}

testUpdate()
