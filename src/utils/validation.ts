import { toast } from "@/hooks/use-toast";

export const validateWizardData = (data: any) => {
  if (!data) return false;
  
  // Validate business idea
  if (data.business_idea && typeof data.business_idea !== 'object') {
    console.error('[Validation] Invalid business idea format');
    return false;
  }

  // Validate target audience
  if (data.target_audience && typeof data.target_audience !== 'object') {
    console.error('[Validation] Invalid target audience format');
    return false;
  }

  // Validate generated ads
  if (data.generated_ads && !Array.isArray(data.generated_ads)) {
    console.error('[Validation] Invalid generated ads format');
    return false;
  }

  return true;
};

export const validateProjectData = (data: any) => {
  if (!data) return false;

  const requiredFields = ['title', 'user_id'];
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`[Validation] Missing required field: ${field}`);
      return false;
    }
  }

  return true;
};

export const handleSaveError = (error: any, context: string) => {
  console.error(`[${context}] Save error:`, error);
  toast({
    title: "Save Error",
    description: "Failed to save your progress. Please try again.",
    variant: "destructive",
  });
  return false;
};