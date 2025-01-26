export interface WizardHook {
  imageUrl?: string;
  description?: string;
  text?: string;
}

export interface WizardData {
  user_id?: string;
  business_idea?: Record<string, any>;
  target_audience?: Record<string, any>;
  audience_analysis?: Record<string, any>;
  generated_ads?: Record<string, any>[];
  current_step?: number;
  version?: number;
  is_migration?: boolean;
  selected_hooks?: Record<string, any>[];
}

export interface WizardProgressData {
  selected_hooks: WizardHook[];
}