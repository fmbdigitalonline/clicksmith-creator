export type BusinessIdea = {
  description: string;
  valueProposition: string;
};

export type TargetAudience = {
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
  audienceAnalysis?: AudienceAnalysis;
};

export type AudienceAnalysis = {
  expandedDefinition: string;
  marketDesire: string;
  awarenessLevel: string;
  sophisticationLevel: string;
  deepPainPoints: string[];
  potentialObjections: string[];
};

export type AdHook = {
  text: string;
  description: string;
};

export type AdFormat = {
  format: string;
  dimensions: {
    width: number;
    height: number;
  };
  aspectRatio: string;
  description: string;
  platform: 'facebook' | 'google';
};

export type MarketingCampaign = {
  angles: Array<{
    description: string;
    hook: string;
  }>;
  adCopies: Array<{
    type: 'story' | 'short' | 'aida';
    content: string;
  }>;
  headlines: string[];
};

export type AdImage = {
  url: string;
  prompt: string;
};

export type Step = "idea" | "audience" | "analysis" | "campaign" | "format" | "size" | "hook" | "complete";

export type WizardProgress = {
  id: string;
  user_id: string;
  business_idea: BusinessIdea | null;
  target_audience: TargetAudience | null;
  audience_analysis: AudienceAnalysis | null;
  selected_hooks: AdHook[] | null;
  ad_format: {
    format: string;
    dimensions: {
      width: number;
      height: number;
    };
  } | null;
  video_ad_preferences: {
    format: string;
    duration: number;
  } | null;
  generated_ads: any[] | null;
  current_step: number;
  created_at: string;
  updated_at: string;
};

export type AnonymousWizardData = {
  business_idea?: BusinessIdea;
  target_audience?: TargetAudience;
  audience_analysis?: AudienceAnalysis;
  selected_hooks?: AdHook[];
  generated_ads?: any[];
  completed?: boolean;
};