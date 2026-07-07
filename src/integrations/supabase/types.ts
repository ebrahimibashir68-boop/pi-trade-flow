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
      contract_compliance: {
        Row: {
          contract_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["compliance_kind"]
          payload: Json
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["compliance_kind"]
          payload: Json
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["compliance_kind"]
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_compliance_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_parties: {
        Row: {
          contract_id: string
          country: string
          created_at: string
          email: string | null
          id: string
          identifier: string | null
          invited_at: string | null
          joined_uid: string | null
          name: string
          party_type: Database["public"]["Enums"]["party_type"]
          pi_username: string | null
          role: Database["public"]["Enums"]["party_role"]
        }
        Insert: {
          contract_id: string
          country: string
          created_at?: string
          email?: string | null
          id?: string
          identifier?: string | null
          invited_at?: string | null
          joined_uid?: string | null
          name: string
          party_type: Database["public"]["Enums"]["party_type"]
          pi_username?: string | null
          role: Database["public"]["Enums"]["party_role"]
        }
        Update: {
          contract_id?: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          identifier?: string | null
          invited_at?: string | null
          joined_uid?: string | null
          name?: string
          party_type?: Database["public"]["Enums"]["party_type"]
          pi_username?: string | null
          role?: Database["public"]["Enums"]["party_role"]
        }
        Relationships: [
          {
            foreignKeyName: "contract_parties_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip: string | null
          method: Database["public"]["Enums"]["sig_method"]
          party_id: string
          signature_image: string | null
          signed_at: string
          signed_hash: string
          signer_uid: string
          signer_username: string | null
          typed_name: string | null
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          ip?: string | null
          method: Database["public"]["Enums"]["sig_method"]
          party_id: string
          signature_image?: string | null
          signed_at?: string
          signed_hash: string
          signer_uid: string
          signer_username?: string | null
          typed_name?: string | null
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          ip?: string | null
          method?: Database["public"]["Enums"]["sig_method"]
          party_id?: string
          signature_image?: string | null
          signed_at?: string
          signed_hash?: string
          signer_uid?: string
          signer_username?: string | null
          typed_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "contract_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_translations: {
        Row: {
          body_markdown: string
          contract_id: string
          created_at: string
          id: string
          lang: string
        }
        Insert: {
          body_markdown: string
          contract_id: string
          created_at?: string
          id?: string
          lang: string
        }
        Update: {
          body_markdown?: string
          contract_id?: string
          created_at?: string
          id?: string
          lang?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_translations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          author_uid: string
          author_username: string | null
          body_markdown: string
          commodity: string
          content_hash: string
          created_at: string
          delivery_window: string
          id: string
          incoterm: string
          notes: string | null
          price_pi: string
          quantity: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          author_uid: string
          author_username?: string | null
          body_markdown?: string
          commodity: string
          content_hash?: string
          created_at?: string
          delivery_window: string
          id?: string
          incoterm: string
          notes?: string | null
          price_pi: string
          quantity: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          author_uid?: string
          author_username?: string | null
          body_markdown?: string
          commodity?: string
          content_hash?: string
          created_at?: string
          delivery_window?: string
          id?: string
          incoterm?: string
          notes?: string | null
          price_pi?: string
          quantity?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      compliance_kind: "hs" | "sanctions" | "docs"
      contract_status:
        | "draft"
        | "awaiting_signatures"
        | "signed"
        | "executed"
        | "cancelled"
      party_role: "exporter" | "importer" | "witness"
      party_type: "individual" | "company" | "government"
      sig_method: "pi" | "typed" | "drawn"
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
      compliance_kind: ["hs", "sanctions", "docs"],
      contract_status: [
        "draft",
        "awaiting_signatures",
        "signed",
        "executed",
        "cancelled",
      ],
      party_role: ["exporter", "importer", "witness"],
      party_type: ["individual", "company", "government"],
      sig_method: ["pi", "typed", "drawn"],
    },
  },
} as const
