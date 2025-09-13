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
  title: string
  description?: string
  file_name?: string
  file_url?: string
  file_size?: number
  file_type?: string
  exhibit_id?: string
  number_of_pages?: number
  date_submitted?: string
  method?: string
  url_link?: string
  book_of_deeds_ref?: string
  display_order?: number
  case_number?: string
  created_at: string
  updated_at: string
}