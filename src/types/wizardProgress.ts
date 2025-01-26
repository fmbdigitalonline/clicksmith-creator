export interface WizardHook {
  imageUrl?: string;
  description?: string;
  text?: string;
}

export interface WizardProgressData {
  selected_hooks: WizardHook[];
}