// Test claims query to see if the basic query works
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vwrgnlpajtwifbgyiutk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cmdubHBhanR3aWZiZ3lpdXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDI1NzMsImV4cCI6MjA2MzkxODU3M30.gFv5gbOMyVPArjySwnaQmHDHhM0L47kOX4sjjREbIZc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testClaimsQuery() {
  try {
    console.log('Testing claims query...')
    
    // Test 1: Simple select all
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Query error:', error)
    } else {
      console.log('Query successful:', data)
    }
    
    // Test 2: Select specific columns
    const { data: data2, error: error2 } = await supabase
      .from('claims')
      .select('claim_id, case_number, title, court, plaintiff_name, defendant_name, description, status, user_id')
      .limit(1)
    
    if (error2) {
      console.error('Specific columns query error:', error2)
    } else {
      console.log('Specific columns query successful:', data2)
    }
    
  } catch (err) {
    console.error('Test failed:', err)
  }
}

testClaimsQuery()
