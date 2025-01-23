import React from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BusinessIdea } from '@/types/adWizard';

interface BusinessIdeaFormProps {
  value: BusinessIdea | null;
  onChange: (idea: BusinessIdea) => void;
  onNext: () => void;
}

export const BusinessIdeaForm: React.FC<BusinessIdeaFormProps> = ({
  value,
  onChange,
  onNext,
}) => {
  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Describe your business idea..."
        value={value?.description || ''}
        onChange={(e) =>
          onChange({ ...value, description: e.target.value } as BusinessIdea)
        }
      />
      <Textarea
        placeholder="What's your value proposition?"
        value={value?.valueProposition || ''}
        onChange={(e) =>
          onChange({ ...value, valueProposition: e.target.value } as BusinessIdea)
        }
      />
      <Button onClick={onNext}>Next</Button>
    </div>
  );
};