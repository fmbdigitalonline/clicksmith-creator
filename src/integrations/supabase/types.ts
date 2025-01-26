export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ad_feedback: {
        Row: {
          ad_id: string | null
          created_at: string
          feedback: string | null
          headline: string | null
          id: string
          primary_text: string | null
          project_data: Json | null
          project_id: string | null
          rating: number | null
          saved_images: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ad_id?: string | null
          created_at?: string
          feedback?: string | null
          headline?: string | null
          id?: string
          primary_text?: string | null
          project_data?: Json | null
          project_id?: string | null
          rating?: number | null
          saved_images?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ad_id?: string | null
          created_at?: string
          feedback?: string | null
          headline?: string | null
          id?: string
          primary_text?: string | null
          project_data?: Json | null
          project_id?: string | null
          rating?: number | null
          saved_images?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_image_variants: {
        Row: {
          created_at: string
          id: string
          original_image_url: string
          project_id: string | null
          resized_image_urls: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          original_image_url: string
          project_id?: string | null
          resized_image_urls?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          original_image_url?: string
          project_id?: string | null
          resized_image_urls?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_image_variants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      anonymous_usage: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          last_completed_step: number | null
          last_save_attempt: string | null
          save_count: number | null
          session_id: string
          used: boolean | null
          wizard_data: Json | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_completed_step?: number | null
          last_save_attempt?: string | null
          save_count?: number | null
          session_id: string
          used?: boolean | null
          wizard_data?: Json | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_completed_step?: number | null
          last_save_attempt?: string | null
          save_count?: number | null
          session_id?: string
          used?: boolean | null
          wizard_data?: Json | null
        }
        Relationships: []
      }
      credit_operations: {
        Row: {
          created_at: string
          credits_amount: number
          error_message: string | null
          id: string
          operation_type: Database["public"]["Enums"]["credit_operation_type"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_amount: number
          error_message?: string | null
          id?: string
          operation_type?: Database["public"]["Enums"]["credit_operation_type"]
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_amount?: number
          error_message?: string | null
          id?: string
          operation_type?: Database["public"]["Enums"]["credit_operation_type"]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_backups: {
        Row: {
          backup_type: Database["public"]["Enums"]["backup_type"]
          created_at: string
          data: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          backup_type?: Database["public"]["Enums"]["backup_type"]
          created_at?: string
          data: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          backup_type?: Database["public"]["Enums"]["backup_type"]
          created_at?: string
          data?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          created_at: string
          id: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      free_tier_usage: {
        Row: {
          created_at: string
          generations_used: number | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generations_used?: number | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generations_used?: number | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_locks: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          lock_type: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          lock_type: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          lock_type?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          duration: number | null
          folder_id: string | null
          id: string
          source_url: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration?: number | null
          folder_id?: string | null
          id?: string
          source_url?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration?: number | null
          folder_id?: string | null
          id?: string
          source_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          steps_completed: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          steps_completed?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          steps_completed?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          description: string | null
          id: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          customer_email?: string | null
          description?: string | null
          id?: string
          status: string
          stripe_payment_intent?: string | null
          stripe_session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          description?: string | null
          id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean | null
          created_at: string
          credits: number
          description: string | null
          features: Json | null
          id: string
          name: string
          price: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          credits: number
          description?: string | null
          features?: Json | null
          id?: string
          name: string
          price: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          credits?: number
          description?: string | null
          features?: Json | null
          id?: string
          name?: string
          price?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean | null
          payment_status: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          payment_status?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          payment_status?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          ad_dimensions: Json | null
          ad_format: string | null
          audience_analysis: Json | null
          business_idea: Json | null
          created_at: string
          description: string | null
          generated_ads: Json | null
          id: string
          marketing_campaign: Json | null
          selected_hooks: Json | null
          status: string | null
          tags: string[] | null
          target_audience: Json | null
          title: string
          updated_at: string
          user_id: string
          video_ad_preferences: Json | null
          video_ad_settings: Json | null
          video_ads_enabled: boolean | null
        }
        Insert: {
          ad_dimensions?: Json | null
          ad_format?: string | null
          audience_analysis?: Json | null
          business_idea?: Json | null
          created_at?: string
          description?: string | null
          generated_ads?: Json | null
          id?: string
          marketing_campaign?: Json | null
          selected_hooks?: Json | null
          status?: string | null
          tags?: string[] | null
          target_audience?: Json | null
          title: string
          updated_at?: string
          user_id: string
          video_ad_preferences?: Json | null
          video_ad_settings?: Json | null
          video_ads_enabled?: boolean | null
        }
        Update: {
          ad_dimensions?: Json | null
          ad_format?: string | null
          audience_analysis?: Json | null
          business_idea?: Json | null
          created_at?: string
          description?: string | null
          generated_ads?: Json | null
          id?: string
          marketing_campaign?: Json | null
          selected_hooks?: Json | null
          status?: string | null
          tags?: string[] | null
          target_audience?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
          video_ad_preferences?: Json | null
          video_ad_settings?: Json | null
          video_ads_enabled?: boolean | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active: boolean | null
          created_at: string
          credits_remaining: number
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          credits_remaining?: number
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          credits_remaining?: number
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_progress: {
        Row: {
          ad_format: Json | null
          audience_analysis: Json | null
          business_idea: Json | null
          created_at: string
          current_step: number | null
          generated_ads: Json | null
          id: string
          is_migration: boolean | null
          last_save_attempt: string | null
          selected_hooks: Json | null
          target_audience: Json | null
          updated_at: string
          user_id: string
          version: number | null
          video_ad_preferences: Json | null
        }
        Insert: {
          ad_format?: Json | null
          audience_analysis?: Json | null
          business_idea?: Json | null
          created_at?: string
          current_step?: number | null
          generated_ads?: Json | null
          id?: string
          is_migration?: boolean | null
          last_save_attempt?: string | null
          selected_hooks?: Json | null
          target_audience?: Json | null
          updated_at?: string
          user_id: string
          version?: number | null
          video_ad_preferences?: Json | null
        }
        Update: {
          ad_format?: Json | null
          audience_analysis?: Json | null
          business_idea?: Json | null
          created_at?: string
          current_step?: number | null
          generated_ads?: Json | null
          id?: string
          is_migration?: boolean | null
          last_save_attempt?: string | null
          selected_hooks?: Json | null
          target_audience?: Json | null
          updated_at?: string
          user_id?: string
          version?: number | null
          video_ad_preferences?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_credits: {
        Args: {
          p_user_id: string
          p_credits: number
        }
        Returns: {
          success: boolean
          current_credits: number
          error_message: string
        }[]
      }
      allocate_credits: {
        Args: {
          p_user_id: string
          p_credits: number
          p_payment_id: string
          p_description: string
        }
        Returns: {
          success: boolean
          message: string
        }[]
      }
      atomic_migration: {
        Args: {
          p_user_id: string
          p_session_id: string
        }
        Returns: {
          ad_format: Json | null
          audience_analysis: Json | null
          business_idea: Json | null
          created_at: string
          current_step: number | null
          generated_ads: Json | null
          id: string
          is_migration: boolean | null
          last_save_attempt: string | null
          selected_hooks: Json | null
          target_audience: Json | null
          updated_at: string
          user_id: string
          version: number | null
          video_ad_preferences: Json | null
        }
      }
      check_user_credits: {
        Args: {
          p_user_id: string
          required_credits: number
        }
        Returns: {
          has_credits: boolean
          error_message: string
        }[]
      }
      cleanup_stale_locks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      deduct_user_credits: {
        Args: {
          input_user_id: string
          credits_to_deduct: number
        }
        Returns: {
          success: boolean
          current_credits: number
          error_message: string
        }[]
      }
      log_credit_operation: {
        Args: {
          p_user_id: string
          p_operation_type: string
          p_credits_amount: number
          p_status: string
          p_error_message?: string
        }
        Returns: undefined
      }
      migrate_wizard_progress: {
        Args: {
          p_user_id: string
          p_session_id: string
          p_business_idea: Json
          p_target_audience: Json
          p_audience_analysis: Json
          p_generated_ads: Json
          p_current_step: number
        }
        Returns: undefined
      }
    }
    Enums: {
      backup_type: "auto" | "manual"
      credit_operation_type: "credit_add" | "credit_deduct" | "credit_refund"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
