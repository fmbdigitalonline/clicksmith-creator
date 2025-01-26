import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWizardState } from "./WizardStateProvider";
import WizardSteps from "./WizardSteps";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import WizardHeader from "./WizardHeader";
import WizardAuthentication from "./WizardAuthentication";
import { WizardData } from "@/types/wizardProgress";
import { useToast } from "@/hooks/use-toast";

const WizardContent = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();
  const {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    setCurrentStep,
    setBusinessIdea,
    setTargetAudience,
    setAudienceAnalysis,
  } = useWizardState();

  const { data: user, error: userError } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('[WizardContent] User fetch error:', error);
        throw error;
      }
      return user;
    },
    retry: 1,
  });

  // Validate required data for current step
  useEffect(() => {
    console.log('[WizardContent] Validating step requirements:', {
      currentStep,
      hasBusinessIdea: !!businessIdea,
      hasTargetAudience: !!targetAudience,
      hasAudienceAnalysis: !!audienceAnalysis
    });

    if (currentStep > 1 && !businessIdea) {
      console.log('[WizardContent] Missing business idea, redirecting to step 1');
      setCurrentStep(1);
      navigate("/ad-wizard/new");
      return;
    }

    if (currentStep > 2 && !targetAudience) {
      console.log('[WizardContent] Missing target audience, redirecting to step 2');
      setCurrentStep(2);
      navigate("/ad-wizard/new");
      return;
    }

    if (currentStep > 3 && !audienceAnalysis) {
      console.log('[WizardContent] Missing audience analysis, redirecting to step 3');
      setCurrentStep(3);
      navigate("/ad-wizard/new");
      return;
    }
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis, navigate, setCurrentStep]);

  const handleUserChange = (newUser: any) => {
    console.log('[WizardContent] User changed:', newUser);
    if (!newUser) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to continue.",
        variant: "destructive",
      });
    }
  };

  const handleAnonymousDataChange = (data: WizardData) => {
    console.log('[WizardContent] Anonymous data changed:', data);
    if (data.business_idea) setBusinessIdea(data.business_idea);
    if (data.target_audience) setTargetAudience(data.target_audience);
    if (data.audience_analysis) setAudienceAnalysis(data.audience_analysis);
  };

  if (userError) {
    console.error('[WizardContent] User fetch error:', userError);
    toast({
      title: "Error",
      description: "Failed to load user data. Please try again.",
      variant: "destructive",
    });
    return null;
  }

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <WizardHeader 
        title="Ad Creation Wizard" 
        description="Create your perfect ad in just a few steps"
      />
      <WizardAuthentication
        onUserChange={handleUserChange}
        onAnonymousDataChange={handleAnonymousDataChange}
      />
      <WizardSteps
        currentUser={user}
        videoAdsEnabled={false}
        generatedAds={[]}
        hasLoadedInitialAds={false}
        onCreateProject={() => {}}
        renderSaveButton={() => null}
      />
    </div>
  );
};

export default WizardContent;