// Simple test to verify database connection and schema
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vwrgnlpajtwifbgyiutk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cmdubHBhanR3aWZiZ3lpdXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDI1NzMsImV4cCI6MjA2MzkxODU3M30.gFv5gbOMyVPArjySwnaQmHDHhM0L47kOX4sjjREbIZc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testQuery() {
  try {
    console.log('Testing simple query...')
    
    // Test 1: Simple select
    const { data, error } = await supabase
      .from('claims')
      .select('claim_id, case_number, title')
      .limit(1)
    
    if (error) {
      console.error('Query error:', error)
    } else {
      console.log('Query successful:', data)
    }
    
    // Test 2: Check table structure
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'claims')
    
    if (columnError) {
      console.error('Column query error:', columnError)
    } else {
      console.log('Table columns:', columns)
    }
    
  } catch (err) {
    console.error('Test failed:', err)
  }
}

testQuery()
