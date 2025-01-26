export interface WizardHook {
  imageUrl?: string;
  description?: string;
  text?: string;
}

export interface WizardData {
  user_id?: string;
  business_idea?: any;
  target_audience?: any;
  audience_analysis?: any;
  generated_ads?: any[];
  current_step?: number;
  version?: number;
  is_migration?: boolean;
  selected_hooks?: WizardHook[];
}

export interface WizardProgressData {
  selected_hooks: WizardHook[];
}