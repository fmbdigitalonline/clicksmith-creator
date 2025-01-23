import { toast } from "@/hooks/use-toast";

export const validateWizardData = (data: any): boolean => {
  if (!data || typeof data !== 'object') {
    console.error('[Validation] Invalid data format');
    return false;
  }
  
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

  // Validate version
  if (data.version && typeof data.version !== 'number') {
    console.error('[Validation] Invalid version format');
    return false;
  }

  // Validate selected hooks
  if (data.selected_hooks && !Array.isArray(data.selected_hooks)) {
    console.error('[Validation] Invalid selected hooks format');
    return false;
  }

  return true;
};

export const validateProjectData = (data: any): boolean => {
  if (!data || typeof data !== 'object') {
    console.error('[Validation] Invalid project data format');
    return false;
  }

  const requiredFields = ['title', 'user_id'];
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`[Validation] Missing required field: ${field}`);
      return false;
    }
  }

  return true;
};

export const handleSaveError = (error: any, context: string): boolean => {
  console.error(`[${context}] Save error:`, error);
  
  let message = 'Failed to save your progress. Please try again.';
  
  if (error.message?.includes('Concurrent save detected')) {
    message = 'Another save is in progress. Please wait a moment and try again.';
  } else if (error.message?.includes('rate limit')) {
    message = 'You are saving too frequently. Please wait a moment before trying again.';
  }
  
  toast({
    title: "Save Error",
    description: message,
    variant: "destructive",
  });
  
  return false;
};