// Utility functions for handling dual-key system (claim_id + case_number)
// claim_id: Internal UUID primary key for database relationships
// case_number: Human-readable identifier for display and user interaction

import { supabase } from '@/integrations/supabase/client'

/**
 * Get claim_id from case_number
 * Used when we have a case_number but need the internal claim_id for database operations
 */
export async function getClaimIdFromCaseNumber(caseNumber: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('claim_id')
      .eq('case_number', caseNumber)
      .single()
    
    if (error) {
      console.error('Error getting claim_id from case_number:', error)
      return null
    }
    
    return data?.claim_id || null
  } catch (error) {
    console.error('Error getting claim_id from case_number:', error)
    return null
  }
}

/**
 * Get case_number from claim_id
 * Used when we have a claim_id but need the case_number for display
 */
export async function getCaseNumberFromClaimId(claimId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('case_number')
      .eq('claim_id', claimId)
      .single()
    
    if (error) {
      console.error('Error getting case_number from claim_id:', error)
      return null
    }
    
    return data?.case_number || null
  } catch (error) {
    console.error('Error getting case_number from claim_id:', error)
    return null
  }
}

/**
 * Convert an array of case_numbers to claim_ids
 * Used for bulk operations where we have case_numbers but need claim_ids
 */
export async function getClaimIdsFromCaseNumbers(caseNumbers: string[]): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('claim_id')
      .in('case_number', caseNumbers)
    
    if (error) {
      console.error('Error getting claim_ids from case_numbers:', error)
      return []
    }
    
    return data?.map(item => item.claim_id) || []
  } catch (error) {
    console.error('Error getting claim_ids from case_numbers:', error)
    return []
  }
}

/**
 * Convert an array of claim_ids to case_numbers
 * Used for bulk operations where we have claim_ids but need case_numbers for display
 */
export async function getCaseNumbersFromClaimIds(claimIds: string[]): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('case_number')
      .in('claim_id', claimIds)
    
    if (error) {
      console.error('Error getting case_numbers from claim_ids:', error)
      return []
    }
    
    return data?.map(item => item.case_number) || []
  } catch (error) {
    console.error('Error getting case_numbers from claim_ids:', error)
    return []
  }
}

/**
 * Create a claim with both claim_id and case_number
 * This ensures both fields are properly set when creating new claims
 */
export async function createClaimWithBothKeys(claimData: {
  case_number: string
  title: string
  court: string
  plaintiff_name?: string | null
  defendant_name?: string | null
  description?: string | null
  status?: string
  color?: string | null
  user_id: string
}): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .insert([claimData])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating claim:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error creating claim:', error)
    throw error
  }
}

/**
 * Update a claim by case_number (user-friendly identifier)
 * This allows the application to continue using case_number for updates
 */
export async function updateClaimByCaseNumber(caseNumber: string, updates: any): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .update(updates)
      .eq('case_number', caseNumber)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating claim by case_number:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error updating claim by case_number:', error)
    throw error
  }
}

/**
 * Delete a claim by case_number (user-friendly identifier)
 * This allows the application to continue using case_number for deletions
 */
export async function deleteClaimByCaseNumber(caseNumber: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('claims')
      .delete()
      .eq('case_number', caseNumber)
    
    if (error) {
      console.error('Error deleting claim by case_number:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error deleting claim by case_number:', error)
    return false
  }
}
