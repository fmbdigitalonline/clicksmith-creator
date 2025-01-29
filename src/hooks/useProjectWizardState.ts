import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from '@/types/adWizard';

export const useProjectWizardState = () => {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const saveToProject = async (data: {
    businessIdea?: BusinessIdea;
    targetAudience?: TargetAudience;
    audienceAnalysis?: AudienceAnalysis;
    currentStep?: number;
  }) => {
    if (!projectId || projectId === 'new') return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('projects')
        .update({
          business_idea: data.businessIdea || null,
          target_audience: data.targetAudience || null,
          audience_analysis: data.audienceAnalysis || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;

      // Only save to wizard_progress if we're in a project context
      if (projectId !== 'new') {
        const { error: wizardError } = await supabase
          .from('wizard_progress')
          .upsert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            business_idea: data.businessIdea || null,
            target_audience: data.targetAudience || null,
            audience_analysis: data.audienceAnalysis || null,
            current_step: data.currentStep || 1,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (wizardError) {
          console.error('Error saving wizard progress:', wizardError);
        }
      }
    } catch (error) {
      console.error('Error saving project data:', error);
      toast({
        title: "Error saving progress",
        description: "There was an error saving your progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    projectId,
    isSaving,
    saveToProject
  };
};