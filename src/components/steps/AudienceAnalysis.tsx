import React from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudienceAnalysis as AudienceAnalysisType, BusinessIdea, TargetAudience } from '@/types/adWizard';

interface AudienceAnalysisProps {
  value: AudienceAnalysisType | null;
  onChange: (analysis: AudienceAnalysisType) => void;
  onNext: () => void;
  onBack: () => void;
  businessIdea: BusinessIdea | null;
  targetAudience: TargetAudience | null;
}

export const AudienceAnalysis: React.FC<AudienceAnalysisProps> = ({
  value,
  onChange,
  onNext,
  onBack,
  businessIdea,
  targetAudience,
}) => {
  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Expanded audience definition..."
        value={value?.expandedDefinition || ''}
        onChange={(e) =>
          onChange({ ...value, expandedDefinition: e.target.value } as AudienceAnalysisType)
        }
      />
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  );
};