export interface Claim {
  case_number: string
  user_id: string
  title: string
  court?: string
  plaintiff_name?: string
  defendant_name?: string
  description?: string
  status: string
  created_at: string
  updated_at: string
}

export interface Evidence {
  id: string
  user_id: string
  file_name?: string
  file_url?: string
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