export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          all_day: boolean
          claim_id: string | null
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          responsible_user_id: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          claim_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          responsible_user_id?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          claim_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          responsible_user_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_responsible_user_fk",
            columns: ["responsible_user_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          message: string
          message_type: string
          metadata: Json | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          message: string
          message_type?: string
          metadata?: Json | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_claim_case_number_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["case_number"]
          },
        ]
      }
      claim_shares: {
        Row: {
          can_view_evidence: boolean
          claim_id: string
          created_at: string
          donation_amount: number | null
          donation_paid: boolean
          donation_paid_at: string | null
          donation_required: boolean
          id: string
          owner_id: string
          permission: Database["public"]["Enums"]["share_permission"]
          shared_with_id: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          can_view_evidence?: boolean
          claim_id: string
          created_at?: string
          donation_amount?: number | null
          donation_paid?: boolean
          donation_paid_at?: string | null
          donation_required?: boolean
          id?: string
          owner_id: string
          permission?: Database["public"]["Enums"]["share_permission"]
          shared_with_id: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          can_view_evidence?: boolean
          claim_id?: string
          created_at?: string
          donation_amount?: number | null
          donation_paid?: boolean
          donation_paid_at?: string | null
          donation_required?: boolean
          id?: string
          owner_id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          shared_with_id?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_shares_new_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["case_number"]
          },
        ]
      }
      claims: {
        Row: {
          case_number: string
          court: string | null
          created_at: string
          defendant_name: string | null
          description: string | null
          plaintiff_name: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_number: string
          court?: string | null
          created_at?: string
          defendant_name?: string | null
          description?: string | null
          plaintiff_name?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_number?: string
          court?: string | null
          created_at?: string
          defendant_name?: string | null
          description?: string | null
          plaintiff_name?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence: {
        Row: {
          book_of_deeds_ref: string | null
          case_number: string | null
          created_at: string
          date_submitted: string | null
          display_order: number | null
          exhibit_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          method: string | null
          number_of_pages: number | null
          updated_at: string
          url_link: string | null
          user_id: string
        }
        Insert: {
          book_of_deeds_ref?: string | null
          case_number?: string | null
          created_at?: string
          date_submitted?: string | null
          display_order?: number | null
          exhibit_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          method?: string | null
          number_of_pages?: number | null
          updated_at?: string
          url_link?: string | null
          user_id: string
        }
        Update: {
          book_of_deeds_ref?: string | null
          case_number?: string | null
          created_at?: string
          date_submitted?: string | null
          display_order?: number | null
          exhibit_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          method?: string | null
          number_of_pages?: number | null
          updated_at?: string
          url_link?: string | null
          user_id?: string
        }
        Relationships: []
      }
      evidence_claims: {
        Row: {
          claim_id: string
          created_at: string
          evidence_id: string
          id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          evidence_id: string
          id?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          evidence_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_claims_new_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["case_number"]
          },
        ]
      }
      exhibits: {
        Row: {
          created_at: string
          description: string | null
          exhibit_number: number
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exhibit_number: number
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exhibit_number?: number
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_evidence: {
        Row: {
          book_of_deeds_ref: string | null
          claim_id: string
          created_at: string
          date_submitted: string | null
          exhibit_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          method: string | null
          number_of_pages: number | null
          reviewed_at: string | null
          reviewer_notes: string | null
          status: string
          submitted_at: string
          submitter_id: string
          updated_at: string
          url_link: string | null
        }
        Insert: {
          book_of_deeds_ref?: string | null
          claim_id: string
          created_at?: string
          date_submitted?: string | null
          exhibit_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          method?: string | null
          number_of_pages?: number | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          submitter_id: string
          updated_at?: string
          url_link?: string | null
        }
        Update: {
          book_of_deeds_ref?: string | null
          claim_id?: string
          created_at?: string
          date_submitted?: string | null
          exhibit_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          method?: string | null
          number_of_pages?: number | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          submitter_id?: string
          updated_at?: string
          url_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_evidence_claim_case_number_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["case_number"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      todos: {
        Row: {
          alarm_enabled: boolean
          alarm_time: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          evidence_id: string | null
          id: string
          responsible_user_id: string | null
          priority: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alarm_enabled?: boolean
          alarm_time?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          evidence_id?: string | null
          id?: string
          responsible_user_id?: string | null
          priority?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alarm_enabled?: boolean
          alarm_time?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          evidence_id?: string | null
          id?: string
          responsible_user_id?: string | null
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_responsible_user_fk",
            columns: ["responsible_user_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_pending_evidence: {
        Args: { pending_id: string; reviewer_notes_param?: string }
        Returns: string
      }
      check_collaborator_limit: {
        Args: { claim_id_param: string; new_collaborator_count: number }
        Returns: Json
      }
      has_claim_access: {
        Args: { claim_case_number: string; input_user_id: string }
        Returns: boolean
      }
      is_donation_required_for_share: {
        Args: { claim_id_param: string }
        Returns: boolean
      }
      reject_pending_evidence: {
        Args: { pending_id: string; reviewer_notes_param: string }
        Returns: undefined
      }
      user_owns_evidence: {
        Args: { evidence_id_param: string; user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      share_permission: "view" | "edit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      share_permission: ["view", "edit"],
    },
  },
} as const
