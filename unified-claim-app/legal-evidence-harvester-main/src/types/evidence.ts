
export interface Evidence {
  id: string;
  file_name: string | null;
  file_url: string | null;
  exhibit_id: string | null;
  number_of_pages: number | null;
  date_submitted: string | null;
  method: string | null;
  url_link: string | null;
  book_of_deeds_ref: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  claimIds: string[];
}

export type EvidenceInput = Omit<Evidence, 'id' | 'created_at' | 'updated_at' | 'claimIds' | 'display_order'>;
