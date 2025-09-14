export interface Claim {
  case_number: string
  user_id: string
  title: string
  court?: string
  plaintiff_name?: string
  defendant_name?: string
  description?: string
  status: string
  color?: string
  created_at: string
  updated_at: string
}

export interface Todo {
  id: string
  user_id: string
  title: string
  description?: string
  due_date: string
  completed: boolean
  completed_at?: string
  priority: 'low' | 'medium' | 'high'
  alarm_enabled: boolean
  alarm_time?: string
  case_number?: string
  responsible_user_id?: string
  created_at: string
  updated_at: string
}

export interface Evidence {
  id: string
  user_id: string
  case_number?: string
  name: string // This is the exhibit name
  title?: string // For backward compatibility
  file_name?: string
  file_url?: string
  file_size?: number
  file_type?: string
  method?: string
  url_link?: string
  book_of_deeds_ref?: string
  number_of_pages?: number
  date_submitted?: string
  display_order?: number
  exhibit_number?: number // Original exhibit number
  description?: string
  created_at: string
  updated_at: string
}