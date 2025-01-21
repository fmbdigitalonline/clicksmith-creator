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

type WizardProgress = Database['public']['Tables']['wizard_progress']['Row'];
type WizardData = {
  business_idea?: any;
  target_audience?: any;
  generated_ads?: any[];
};

const AdWizard = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
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

  // Load saved progress including generated ads
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let sessionId = localStorage.getItem('anonymous_session_id');
        
        // Step 1: Ensure anonymous session ID is set
        if (!user && !sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem('anonymous_session_id', sessionId);
          console.log('[AdWizard] Created new anonymous session:', sessionId);
        }
        
        console.log('[AdWizard] Starting loadProgress:', { hasUser: !!user, sessionId });
        
        if (!user) {
          console.log('[AdWizard] Anonymous user detected, checking session:', sessionId);
          if (sessionId) {
            console.log('[AdWizard] Fetching anonymous usage data for session:', sessionId);
            
            // Step 2: Initialize anonymous session record if it doesn't exist
            const { error: createError } = await supabase
              .from('anonymous_usage')
              .upsert({
                session_id: sessionId,
                used: false,
                completed: false,
                wizard_data: {
                  business_idea: null,
                  target_audience: null,
                  generated_ads: []
                } as WizardData
              }, {
                onConflict: 'session_id'
              });

            if (createError) {
              console.error('[AdWizard] Error creating anonymous session:', createError);
              throw createError;
            }

            console.log('[AdWizard] Anonymous session ensured');

            // Step 3: Fetch the latest data after initialization
            const { data: anonymousData, error: anonymousError } = await supabase
              .from('anonymous_usage')
              .select('wizard_data, used, completed')
              .eq('session_id', sessionId)
              .maybeSingle();

            if (anonymousError) {
              console.error('[AdWizard] Error fetching anonymous data:', anonymousError);
              throw anonymousError;
            }

            console.log('[AdWizard] Anonymous data loaded:', anonymousData);

            // Step 4: Handle the wizard data
            if (anonymousData?.wizard_data) {
              const wizardData = anonymousData.wizard_data as WizardData;
              console.log('[AdWizard] Wizard data found:', wizardData);
              
              if (wizardData.generated_ads && Array.isArray(wizardData.generated_ads)) {
                console.log('[AdWizard] Loading anonymous user ads:', wizardData.generated_ads);
                setGeneratedAds(wizardData.generated_ads);
              } else {
                console.log('[AdWizard] No generated ads found in wizard data');
                setGeneratedAds([]);
              }
            } else {
              console.log('[AdWizard] No wizard data found for anonymous session');
              setGeneratedAds([]);
            }
          } else {
            console.log('[AdWizard] No anonymous session ID found');
          }
          
          toast({
            title: "Auto-save disabled",
            description: "Register or log in to automatically save your progress and generated ads.",
            duration: 6000,
          });
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
            setHasLoadedInitialAds(true);
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
        console.error('[AdWizard] Error loading progress:', error);
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
    console.log('[AdWizard] Handling newly generated ads:', newAds);
    setGeneratedAds(newAds);
    
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('anonymous_session_id');

    console.log('[AdWizard] Saving ads:', { hasUser: !!user, sessionId, adsCount: newAds.length });

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
        console.log('[AdWizard] Updating anonymous usage with new ads');
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .upsert({
            session_id: sessionId,
            used: true,
            wizard_data: {
              business_idea: businessIdea,
              target_audience: targetAudience,
              generated_ads: newAds
            } as WizardData
          }, {
            onConflict: 'session_id'
          });

        if (anonymousError) {
          console.error('[AdWizard] Error updating anonymous usage:', anonymousError);
          throw anonymousError;
        }
        
        console.log('[AdWizard] Anonymous usage updated successfully');
      }
    } catch (error) {
      console.error('[AdWizard] Error saving generated ads:', error);
      toast({
        title: "Couldn't save your ads",
        description: "Your ads were generated but we couldn't save them. Please try again.",
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

export default AdWizard;