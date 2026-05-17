const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNTgxNywiZXhwIjoyMDkwMDkxODE3fQ.FMnx4vyN4fvQkFj7jCdAKRQqzq3kLvCuH9MbKZkMx2g'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkJobs() {
  const { data, error, count } = await supabase.from('jobs').select('*', { count: 'exact' })
  if (error) {
    console.error('Error fetching jobs:', error)
  } else {
    console.log(`Total jobs in database: ${count}`)
    console.log(data)
  }
}

checkJobs()
