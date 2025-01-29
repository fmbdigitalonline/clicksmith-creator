import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { Json } from "@/integrations/supabase/types";

export const isBusinessIdea = (data: Json): data is BusinessIdea => {
  return typeof data === 'object' && data !== null && 'description' in data;
};

export const isTargetAudience = (data: Json): data is TargetAudience => {
  return typeof data === 'object' && data !== null && 'segments' in data;
};

export const isAudienceAnalysis = (data: Json): data is AudienceAnalysis => {
  return typeof data === 'object' && data !== null && 'marketDesire' in data;
};