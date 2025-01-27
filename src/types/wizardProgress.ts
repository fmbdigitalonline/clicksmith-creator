import { Json } from "@/integrations/supabase/types";

export interface WizardHook {
  [key: string]: string | undefined;
  imageUrl?: string;
  description?: string;
  text?: string;
}

export interface WizardData {
  [key: string]: any; // Add index signature to satisfy Json type
  id?: string;
  user_id?: string;
  business_idea?: Json;
  target_audience?: Json;
  audience_analysis?: Json;
  generated_ads?: Json[] | null;
  current_step?: number;
  version?: number;
  created_at?: string;
  updated_at?: string;
  last_save_attempt?: string | null;
  selected_hooks?: Record<string, any>[] | null;
  ad_format?: Json;
  video_ad_preferences?: Json;
  is_migration?: boolean;
}

export interface WizardProgressData {
  selected_hooks: WizardHook[];
}