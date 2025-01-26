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

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
      } catch (error) {
        console.error('[WizardContent] User fetch error:', error);
        return null;
      }
    },
    retry: false
  });

  const handleUserChange = (newUser: any) => {
    if (!newUser) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to continue.",
        variant: "destructive",
      });
    }
  };

  const handleAnonymousDataChange = (data: WizardData) => {
    if (data.business_idea) setBusinessIdea(data.business_idea);
    if (data.target_audience) setTargetAudience(data.target_audience);
    if (data.audience_analysis) setAudienceAnalysis(data.audience_analysis);
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-facebook"></div>
      </div>
    );
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