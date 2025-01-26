export interface WizardData {
  id?: string;
  user_id?: string;
  business_idea?: any;
  target_audience?: any;
  audience_analysis?: any;
  generated_ads?: any[] | null;
  current_step?: number;
  version?: number;
  created_at?: string;
  updated_at?: string;
  last_save_attempt?: string | null;
  selected_hooks?: any[] | null;
  ad_format?: any;
  video_ad_preferences?: any;
}