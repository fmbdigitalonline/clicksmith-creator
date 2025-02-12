import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getValidationErrors } from '@/utils/typeGuards';
import { WizardData } from '@/types/wizardProgress';

export const useWizardStateValidation = (data: WizardData | null) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!data) return;

    setIsValidating(true);
    console.log('[StateValidation] Starting validation for wizard data');

    try {
      const { hasErrors, errors } = getValidationErrors(data);
      setValidationErrors(errors);

      if (hasErrors) {
        console.warn('[StateValidation] Found validation errors:', errors);
        toast({
          title: "Data Validation Warning",
          description: "Some data might be incomplete or invalid. This could affect your progress.",
          variant: "destructive",
        });
      } else {
        console.log('[StateValidation] Data validation successful');
      }
    } catch (error) {
      console.error('[StateValidation] Validation error:', error);
      toast({
        title: "Validation Error",
        description: "There was an error validating your data. Some features might be limited.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  }, [data, toast]);

  return {
    isValidating,
    validationErrors,
    hasErrors: validationErrors && Object.values(validationErrors).some((errors: any) => errors.length > 0)
  };
};