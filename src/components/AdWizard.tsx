import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdWizardState } from "@/hooks/useAdWizardState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { BusinessIdeaForm } from "@/components/steps/BusinessIdeaForm";
import { TargetAudienceForm } from "@/components/steps/TargetAudienceForm";
import { AudienceAnalysis } from "@/components/steps/AudienceAnalysis";
import { GeneratedAds } from "@/components/steps/GeneratedAds";
import RegistrationWall from "@/components/steps/auth/RegistrationWall";
import { Ad } from "@/types/ad";
import { useGenerateAds } from "@/hooks/useGenerateAds";

const AdWizard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generatedAds, setGeneratedAds] = useState<Ad[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    currentStep,
    setCurrentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    handleStartOver,
  } = useAdWizardState();

  const { generateAds, isGenerating } = useGenerateAds();

  const handleStartOverWithReset = async () => {
    console.log('[AdWizard] Starting over with full reset');
    setGeneratedAds([]); // Clear generated ads
    setHasLoadedInitialAds(false); // Reset loading state
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // For authenticated users, clear wizard progress in database
        const { error } = await supabase
          .from('wizard_progress')
          .update({
            business_idea: null,
            target_audience: null,
            audience_analysis: null,
            generated_ads: null,
            current_step: 1
          })
          .eq('user_id', session.user.id);

        if (error) {
          console.error('[AdWizard] Error clearing wizard progress:', error);
        }
      } else {
        // For anonymous users, clear wizard data in anonymous_usage
        const sessionId = localStorage.getItem('anonymous_session_id');
        if (sessionId) {
          const { error } = await supabase
            .from('anonymous_usage')
            .update({
              wizard_data: null,
              last_completed_step: 1
            })
            .eq('session_id', sessionId);

          if (error) {
            console.error('[AdWizard] Error clearing anonymous wizard progress:', error);
          }
        }
      }
    } catch (error) {
      console.error('[AdWizard] Error in handleStartOverWithReset:', error);
    }

    handleStartOver(); // Call original handleStartOver from useAdWizardState
  };

  const handleNext = useCallback(async () => {
    if (currentStep === 3 && !generatedAds.length) {
      setIsLoading(true);
      try {
        const ads = await generateAds({
          businessIdea,
          targetAudience,
          audienceAnalysis,
        });
        setGeneratedAds(ads);
      } catch (error) {
        console.error("Error generating ads:", error);
        toast({
          title: "Error",
          description: "Failed to generate ads. Please try again.",
          variant: "destructive",
        });
        return;
      } finally {
        setIsLoading(false);
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }, [
    currentStep,
    setCurrentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    generateAds,
    generatedAds.length,
    toast,
  ]);

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const steps = [
    {
      label: "Business Idea",
      component: (
        <BusinessIdeaForm
          value={businessIdea}
          onChange={(idea) => {
            // Handle business idea changes
          }}
          onNext={handleNext}
        />
      ),
    },
    {
      label: "Target Audience",
      component: (
        <TargetAudienceForm
          value={targetAudience}
          onChange={(audience) => {
            // Handle target audience changes
          }}
          onNext={handleNext}
          onBack={handleBack}
        />
      ),
    },
    {
      label: "Audience Analysis",
      component: (
        <AudienceAnalysis
          value={audienceAnalysis}
          onChange={(analysis) => {
            // Handle audience analysis changes
          }}
          onNext={handleNext}
          onBack={handleBack}
          businessIdea={businessIdea}
          targetAudience={targetAudience}
        />
      ),
    },
    {
      label: "Generated Ads",
      component: (
        <GeneratedAds
          ads={generatedAds}
          onBack={handleBack}
          isLoading={isLoading || isGenerating}
          hasLoadedInitialAds={hasLoadedInitialAds}
        />
      ),
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="p-6">
        <div className="mb-8">
          <Stepper steps={steps.map((s) => s.label)} currentStep={currentStep} />
        </div>
        <div className="mt-8">
          {steps[currentStep - 1].component}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={handleStartOverWithReset}>
              Start Over
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdWizard;