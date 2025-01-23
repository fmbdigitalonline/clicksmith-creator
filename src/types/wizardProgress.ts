export interface WizardHook {
  imageUrl?: string;
  description?: string;
  text?: string;
}

export interface WizardData {
  business_idea?: {
    description: string;
    valueProposition: string;
  } | null;
  target_audience?: {
    name: string;
    description: string;
    demographics: string;
    painPoints: string[];
    icp: string;
    coreMessage: string;
    positioning: string;
    marketingAngle: string;
    messagingApproach: string;
    marketingChannels: string[];
  } | null;
  audience_analysis?: {
    expandedDefinition: string;
    marketDesire: string;
    awarenessLevel: string;
    sophisticationLevel: string;
    deepPainPoints: string[];
    potentialObjections: string[];
  } | null;
  selected_hooks?: Array<{
    text: string;
    description: string;
  }> | null;
  generated_ads?: Array<{
    id: string;
    platform: string;
    imageUrl?: string;
    headline?: string;
    description?: string;
    size?: {
      width: number;
      height: number;
      label: string;
    };
  }> | null;
  current_step?: number;
  version?: number;
}

export interface WizardProgressData {
  selected_hooks: WizardHook[];
}