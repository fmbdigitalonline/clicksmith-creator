import React from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TargetAudience } from '@/types/adWizard';

interface TargetAudienceFormProps {
  value: TargetAudience | null;
  onChange: (audience: TargetAudience) => void;
  onNext: () => void;
  onBack: () => void;
}

export const TargetAudienceForm: React.FC<TargetAudienceFormProps> = ({
  value,
  onChange,
  onNext,
  onBack,
}) => {
  const handleChange = (field: keyof TargetAudience, newValue: any) => {
    onChange({ ...value, [field]: newValue } as TargetAudience);
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Target audience name"
        value={value?.name || ''}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      <Textarea
        placeholder="Describe your target audience..."
        value={value?.description || ''}
        onChange={(e) => handleChange('description', e.target.value)}
      />
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  );
};