import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const validateBusinessIdea = (data: any): ValidationResult => {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Business idea must be an object');
    return { isValid: false, errors };
  }

  if (!('description' in data)) {
    errors.push('Business idea must contain a description');
  } else if (typeof data.description !== 'string') {
    errors.push('Business idea description must be a string');
  }

  if ('valueProposition' in data && typeof data.valueProposition !== 'string') {
    errors.push('Business idea valueProposition must be a string');
  }

  return { 
    isValid: errors.length === 0,
    errors 
  };
};

const validateTargetAudience = (data: any): ValidationResult => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Target audience must be an object');
    return { isValid: false, errors };
  }

  const requiredFields = ['name', 'description', 'demographics', 'painPoints', 'icp', 
    'coreMessage', 'positioning', 'marketingAngle', 'messagingApproach', 'marketingChannels'];

  requiredFields.forEach(field => {
    if (!(field in data)) {
      errors.push(`Target audience must contain ${field}`);
    }
  });

  if (data.painPoints && !Array.isArray(data.painPoints)) {
    errors.push('Pain points must be an array');
  }

  if (data.marketingChannels && !Array.isArray(data.marketingChannels)) {
    errors.push('Marketing channels must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateAudienceAnalysis = (data: any): ValidationResult => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Audience analysis must be an object');
    return { isValid: false, errors };
  }

  const requiredFields = ['expandedDefinition', 'marketDesire', 'awarenessLevel', 
    'sophisticationLevel', 'deepPainPoints', 'potentialObjections'];

  requiredFields.forEach(field => {
    if (!(field in data)) {
      errors.push(`Audience analysis must contain ${field}`);
    }
  });

  if (data.deepPainPoints && !Array.isArray(data.deepPainPoints)) {
    errors.push('Deep pain points must be an array');
  }

  if (data.potentialObjections && !Array.isArray(data.potentialObjections)) {
    errors.push('Potential objections must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const isBusinessIdea = (data: any): data is BusinessIdea => {
  const validation = validateBusinessIdea(data);
  if (!validation.isValid) {
    console.warn('[TypeGuard] Invalid BusinessIdea:', validation.errors);
  }
  return validation.isValid;
};

export const isTargetAudience = (data: any): data is TargetAudience => {
  const validation = validateTargetAudience(data);
  if (!validation.isValid) {
    console.warn('[TypeGuard] Invalid TargetAudience:', validation.errors);
  }
  return validation.isValid;
};

export const isAudienceAnalysis = (data: any): data is AudienceAnalysis => {
  const validation = validateAudienceAnalysis(data);
  if (!validation.isValid) {
    console.warn('[TypeGuard] Invalid AudienceAnalysis:', validation.errors);
  }
  return validation.isValid;
};

export const getValidationErrors = (data: any) => {
  const results = {
    businessIdea: validateBusinessIdea(data?.business_idea),
    targetAudience: validateTargetAudience(data?.target_audience),
    audienceAnalysis: validateAudienceAnalysis(data?.audience_analysis)
  };

  return {
    hasErrors: !results.businessIdea.isValid || 
               !results.targetAudience.isValid || 
               !results.audienceAnalysis.isValid,
    errors: {
      businessIdea: results.businessIdea.errors,
      targetAudience: results.targetAudience.errors,
      audienceAnalysis: results.audienceAnalysis.errors
    }
  };
};