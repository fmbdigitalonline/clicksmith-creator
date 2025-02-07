import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";

export const isBusinessIdea = (data: any): data is BusinessIdea => {
  return data && typeof data === 'object' && 'description' in data;
};

export const isTargetAudience = (data: any): data is TargetAudience => {
  return data && typeof data === 'object' && 'description' in data;
};

export const isAudienceAnalysis = (data: any): data is AudienceAnalysis => {
  return data && typeof data === 'object' && 'marketDesire' in data;
};