export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      readings: {
        Row: {
          closing_note: string | null
          created_at: string
          drawn: Json
          id: string
          question: string | null
          rng_method: string
          rng_seed: string
          session_id: string | null
          spread_slug: string
          system: string
          transcript: string | null
          user_id: string | null
        }
        Insert: {
          closing_note?: string | null
          created_at?: string
          drawn: Json
          id?: string
          question?: string | null
          rng_method?: string
          rng_seed: string
          session_id?: string | null
          spread_slug: string
          system: string
          transcript?: string | null
          user_id?: string | null
        }
        Update: {
          closing_note?: string | null
          created_at?: string
          drawn?: Json
          id?: string
          question?: string | null
          rng_method?: string
          rng_seed?: string
          session_id?: string | null
          spread_slug?: string
          system?: string
          transcript?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "readings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          el_conversation_id: string | null
          ended_at: string | null
          id: string
          started_at: string
          user_id: string | null
        }
        Insert: {
          el_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string | null
        }
        Update: {
          el_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sigils: {
        Row: {
          created_at: string
          id: string
          intent: string
          letters_reduced: string
          model: string | null
          prompt: string | null
          source_upload_id: string | null
          statement: string
          storage_path: string | null
          svg: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intent: string
          letters_reduced: string
          model?: string | null
          prompt?: string | null
          source_upload_id?: string | null
          statement: string
          storage_path?: string | null
          svg: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string
          letters_reduced?: string
          model?: string | null
          prompt?: string | null
          source_upload_id?: string | null
          statement?: string
          storage_path?: string | null
          svg?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sigils_source_upload_id_fkey"
            columns: ["source_upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      spreads: {
        Row: {
          id: string
          name: string
          positions: Json
          slug: string
          system: string
        }
        Insert: {
          id?: string
          name: string
          positions: Json
          slug: string
          system: string
        }
        Update: {
          id?: string
          name?: string
          positions?: Json
          slug?: string
          system?: string
        }
        Relationships: []
      }
      symbols: {
        Row: {
          arcana: string | null
          changing_text: Json | null
          code: string
          id: string
          image_url: string | null
          keywords: string[]
          name: string
          number: number | null
          reversed_text: string | null
          suit: string | null
          system: string
          upright_text: string
        }
        Insert: {
          arcana?: string | null
          changing_text?: Json | null
          code: string
          id?: string
          image_url?: string | null
          keywords?: string[]
          name: string
          number?: number | null
          reversed_text?: string | null
          suit?: string | null
          system: string
          upright_text: string
        }
        Update: {
          arcana?: string | null
          changing_text?: Json | null
          code?: string
          id?: string
          image_url?: string | null
          keywords?: string[]
          name?: string
          number?: number | null
          reversed_text?: string | null
          suit?: string | null
          system?: string
          upright_text?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          extracted_text: string | null
          filename: string | null
          id: string
          kind: string
          mime_type: string | null
          session_id: string | null
          storage_path: string
          summary: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          filename?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          session_id?: string | null
          storage_path: string
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          filename?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          session_id?: string | null
          storage_path?: string
          summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      visions: {
        Row: {
          created_at: string
          id: string
          model: string | null
          prompt: string
          reading_id: string | null
          storage_path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          prompt: string
          reading_id?: string | null
          storage_path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          prompt?: string
          reading_id?: string | null
          storage_path?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visions_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
