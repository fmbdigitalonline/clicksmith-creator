import { useAdWizardState } from "@/hooks/useAdWizardState";
import IdeaStep from "./steps/BusinessIdeaStep";
import AudienceStep from "./steps/AudienceStep";
import AudienceAnalysisStep from "./steps/AudienceAnalysisStep";
import AdGalleryStep from "./steps/AdGalleryStep";
import WizardHeader from "./wizard/WizardHeader";
import WizardProgress from "./WizardProgress";
import { useState, useMemo, useEffect } from "react";
import CreateProjectDialog from "./projects/CreateProjectDialog";
import { useNavigate, useParams } from "react-router-dom";
import { Toggle } from "./ui/toggle";
import { Video, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

type WizardProgress = Database['public']['Tables']['wizard_progress']['Row'];
type WizardData = {
  business_idea?: any;
  target_audience?: any;
  generated_ads?: any[];
};

export const AdWizard = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();
  
  const {
    currentStep,
    businessIdea,
    targetAudience,
    audienceAnalysis,
    selectedHooks,
    handleIdeaSubmit,
    handleAudienceSelect,
    handleAnalysisComplete,
    handleBack,
    handleStartOver,
    canNavigateToStep,
    setCurrentStep,
  } = useAdWizardState();

  // Initialize anonymous session if needed
  useEffect(() => {
    const initializeAnonymousSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        let sessionId = localStorage.getItem('anonymous_session_id');
        if (!sessionId) {
          sessionId = uuidv4();
          localStorage.setItem('anonymous_session_id', sessionId);
        }
        setIsAnonymous(true);
        
        toast({
          title: "Anonymous Mode",
          description: "Your progress will be saved temporarily. Register to keep your ads permanently.",
          duration: 6000,
        });
      }
    };

    initializeAnonymousSession();
  }, [toast]);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const sessionId = localStorage.getItem('anonymous_session_id');
        
        if (!user) {
          console.log('Anonymous user detected, checking session:', sessionId);
          if (sessionId) {
            const { data: anonymousData } = await supabase
              .from('anonymous_usage')
              .select('wizard_data')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonymousData?.wizard_data) {
              const wizardData = anonymousData.wizard_data as WizardData;
              if (wizardData.generated_ads && Array.isArray(wizardData.generated_ads)) {
                console.log('Loading anonymous user ads:', wizardData.generated_ads);
                setGeneratedAds(wizardData.generated_ads);
                
                // Added success confirmation for anonymous users
                toast({
                  title: "Progress Saved",
                  description: "Your ads are saved temporarily. Create an account to keep them permanently.",
                  duration: 4000,
                });
              }
            }
          }
          setHasLoadedInitialAds(true);
          return;
        }

        if (projectId && projectId !== 'new') {
          const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('generated_ads, video_ads_enabled')
            .eq('id', projectId)
            .maybeSingle();

          if (projectError) {
            console.error('Error loading project:', projectError);
            toast({
              title: "Couldn't load your project",
              description: "We had trouble loading your project data. Please try again.",
              variant: "destructive",
            });
            return;
          }

          if (!project) {
            navigate('/ad-wizard/new');
          } else {
            setVideoAdsEnabled(project.video_ads_enabled || false);
            if (project.generated_ads && Array.isArray(project.generated_ads)) {
              console.log('Loading saved ads from project:', project.generated_ads);
              setGeneratedAds(project.generated_ads);
            }
          }
        } else {
          const { data: wizardData, error: wizardError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (wizardError && wizardError.code !== 'PGRST116') {
            console.error('Error loading wizard progress:', wizardError);
            toast({
              title: "Couldn't load your progress",
              description: "We had trouble loading your previous work. Starting fresh.",
              variant: "destructive",
            });
          }

          if (wizardData?.generated_ads && Array.isArray(wizardData.generated_ads)) {
            console.log('Loading saved ads from wizard progress:', wizardData.generated_ads);
            setGeneratedAds(wizardData.generated_ads);
          }
        }
        setHasLoadedInitialAds(true);
      } catch (error) {
        console.error('Error loading progress:', error);
        toast({
          title: "Something went wrong",
          description: "We couldn't load your previous work. Please try refreshing the page.",
          variant: "destructive",
        });
        setHasLoadedInitialAds(true);
      }
    };

    loadProgress();
  }, [projectId, navigate, toast]);

  const handleCreateProject = () => {
    setShowCreateProject(true);
  };

  const handleProjectCreated = (projectId: string) => {
    setShowCreateProject(false);
    navigate(`/ad-wizard/${projectId}`);
  };

  const handleVideoAdsToggle = async (enabled: boolean) => {
    setVideoAdsEnabled(enabled);
    if (projectId && projectId !== 'new') {
      await supabase
        .from('projects')
        .update({ 
          video_ads_enabled: enabled,
          video_ad_preferences: enabled ? {
            format: 'landscape',
            duration: 30
          } : null
        })
        .eq('id', projectId);
    }
  };

  const handleAdsGenerated = async (newAds: any[]) => {
    console.log('Handling newly generated ads:', newAds);
    setGeneratedAds(newAds);
    
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('anonymous_session_id');

    try {
      if (user) {
        if (projectId && projectId !== 'new') {
          const { error: updateError } = await supabase
            .from('projects')
            .update({ generated_ads: newAds })
            .eq('id', projectId);

          if (updateError) throw updateError;
        } else {
          const { error: upsertError } = await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              generated_ads: newAds
            }, {
              onConflict: 'user_id'
            });

          if (upsertError) throw upsertError;
        }
      } else if (sessionId) {
        const anonymousData = {
          session_id: sessionId,
          used: true,
          wizard_data: {
            business_idea: businessIdea,
            target_audience: targetAudience,
            audience_analysis: audienceAnalysis,
            selected_hooks: selectedHooks,
            generated_ads: newAds,
            created_at: new Date().toISOString()
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .upsert(anonymousData, {
            onConflict: 'session_id'
          });

        if (anonymousError) {
          console.error('Error saving anonymous data:', anonymousError);
          throw anonymousError;
        }
      }
    } catch (error) {
      console.error('Error saving generated ads:', error);
      toast({
        title: "Couldn't save your ads",
        description: isAnonymous 
          ? "We couldn't save your temporary progress. Please try again or create an account."
          : "Your ads were generated but we couldn't save them. Please try again.",
        variant: "destructive",
      });
    }
  };

  const currentStepComponent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <IdeaStep onNext={handleIdeaSubmit} />;
      case 2:
        return businessIdea ? (
          <AudienceStep
            businessIdea={businessIdea}
            onNext={handleAudienceSelect}
            onBack={handleBack}
          />
        ) : null;
      case 3:
        return businessIdea && targetAudience ? (
          <AudienceAnalysisStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            onNext={handleAnalysisComplete}
            onBack={handleBack}
          />
        ) : null;
      case 4:
        return businessIdea && targetAudience && audienceAnalysis ? (
          <AdGalleryStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            adHooks={selectedHooks}
            onStartOver={handleStartOver}
            onBack={handleBack}
            onCreateProject={handleCreateProject}
            videoAdsEnabled={videoAdsEnabled}
            generatedAds={generatedAds}
            onAdsGenerated={handleAdsGenerated}
            hasLoadedInitialAds={hasLoadedInitialAds}
          />
        ) : null;
      default:
        return null;
    }
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis, selectedHooks, videoAdsEnabled, generatedAds, hasLoadedInitialAds]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <WizardHeader
        title="Idea Pilot"
        description="Quickly go from idea to ready-to-run ads by testing different audience segments with AI-powered social media ad campaigns."
      />

      <div className="mb-8">
        <WizardProgress
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          canNavigateToStep={canNavigateToStep}
        />
      </div>

      <div className="flex items-center justify-end mb-6 space-x-2">
        <span className="text-sm text-gray-600">Image Ads</span>
        <Toggle
          pressed={videoAdsEnabled}
          onPressedChange={handleVideoAdsToggle}
          aria-label="Toggle video ads"
          className="data-[state=on]:bg-facebook"
        >
          {videoAdsEnabled ? (
            <Video className="h-4 w-4" />
          ) : (
            <Image className="h-4 w-4" />
          )}
        </Toggle>
        <span className="text-sm text-gray-600">Video Ads</span>
      </div>

      {currentStepComponent}

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSuccess={handleProjectCreated}
        initialBusinessIdea={businessIdea?.description}
      />
    </div>
  );
};
