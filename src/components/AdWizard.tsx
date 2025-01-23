import { useAdWizardState } from "@/hooks/useAdWizardState";
import IdeaStep from "./steps/BusinessIdeaStep";
import AudienceStep from "./steps/AudienceStep";
import AudienceAnalysisStep from "./steps/AudienceAnalysisStep";
import AdGalleryStep from "./steps/AdGalleryStep";
import RegistrationWall from "./steps/auth/RegistrationWall";
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
  completed?: boolean;
};

const AdWizard = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [videoAdsEnabled, setVideoAdsEnabled] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<any[]>([]);
  const [hasLoadedInitialAds, setHasLoadedInitialAds] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [anonymousData, setAnonymousData] = useState<WizardData | null>(null);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted) return;
        setCurrentUser(user);

        // Only attempt migration if user just registered
        if (user) {
          const sessionId = localStorage.getItem('anonymous_session_id');
          if (sessionId) {
            console.log('[AdWizard] Found anonymous session data to migrate:', sessionId);
            
            // Lock to prevent race condition
            const migrationLock = localStorage.getItem('migration_in_progress');
            if (migrationLock) {
              console.log('[AdWizard] Migration already in progress');
              return;
            }
            
            localStorage.setItem('migration_in_progress', 'true');

            try {
              const { data: anonData, error: anonError } = await supabase
                .from('anonymous_usage')
                .select('wizard_data, completed')
                .eq('session_id', sessionId)
                .maybeSingle();

              if (anonError) {
                console.error('[AdWizard] Error fetching anonymous data:', anonError);
                return;
              }

              if (anonData?.wizard_data) {
                const wizardData = anonData.wizard_data as WizardData;
                console.log('[AdWizard] Migrating anonymous data:', wizardData);
                
                if (!isMounted) return;
                setAnonymousData(wizardData);
                
                // Migrate data to wizard_progress
                const { error: wizardError } = await supabase
                  .from('wizard_progress')
                  .upsert({
                    user_id: user.id,
                    business_idea: wizardData.business_idea,
                    target_audience: wizardData.target_audience,
                    generated_ads: wizardData.generated_ads,
                    current_step: anonData.completed ? 4 : 2
                  });

                if (wizardError) {
                  console.error('[AdWizard] Error migrating data:', wizardError);
                  toast({
                    title: "Migration Error",
                    description: "There was an error saving your previous work. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }

                // Clear anonymous data only after successful migration
                localStorage.removeItem('anonymous_session_id');
                localStorage.removeItem('migration_in_progress');
                console.log('[AdWizard] Successfully migrated and cleared anonymous session');
              }
            } catch (error) {
              console.error('[AdWizard] Migration error:', error);
              localStorage.removeItem('migration_in_progress');
            }
          }
        }
      } catch (error) {
        console.error('[AdWizard] Error in checkUser:', error);
      }
    };

    checkUser();
    return () => {
      isMounted = false;
    };
  }, [toast]);

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

  useEffect(() => {
    const loadProgress = async () => {
      try {
        console.log('[AdWizard] Starting to load progress');
        const { data: { user } } = await supabase.auth.getUser();
        let sessionId = localStorage.getItem('anonymous_session_id');
        
        // If we have anonymous data to migrate
        if (anonymousData && user) {
          console.log('[AdWizard] Migrating anonymous data to user account');
          const { error: wizardError } = await supabase
            .from('wizard_progress')
            .upsert({
              user_id: user.id,
              business_idea: anonymousData.business_idea,
              target_audience: anonymousData.target_audience,
              generated_ads: anonymousData.generated_ads,
              current_step: 4
            });

          if (wizardError) {
            console.error('[AdWizard] Error migrating anonymous data:', wizardError);
          } else {
            setGeneratedAds(anonymousData.generated_ads || []);
            setAnonymousData(null);
          }
        }

        // If user is authenticated, load their progress
        if (user) {
          const { data: wizardData, error: wizardError } = await supabase
            .from('wizard_progress')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (wizardError) {
            console.error('[AdWizard] Error loading wizard progress:', wizardError);
            toast({
              title: "Couldn't load your progress",
              description: "We had trouble loading your previous work. Starting fresh.",
              variant: "destructive",
            });
          }

          if (wizardData?.generated_ads && Array.isArray(wizardData.generated_ads)) {
            console.log('[AdWizard] Loading saved ads from wizard progress:', wizardData.generated_ads);
            setGeneratedAds(wizardData.generated_ads);
          }
        }

        setHasLoadedInitialAds(true);
      } catch (error) {
        console.error('[AdWizard] Unexpected error in loadProgress:', error);
        toast({
          title: "Something went wrong",
          description: "We couldn't load your previous work. Please try refreshing the page.",
          variant: "destructive",
        });
        setHasLoadedInitialAds(true);
      }
    };

    loadProgress();
  }, [projectId, navigate, toast, anonymousData]);

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
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = localStorage.getItem('anonymous_session_id');

      if (user) {
        console.log('[AdWizard] Saving ads for authenticated user');
        
        // Create a new project if we don't have one
        if (!projectId || projectId === 'new') {
          const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const shortUuid = uuidv4().split('-')[0];
          const projectTitle = `${businessIdea?.description?.slice(0, 30) || 'New Ad Project'} - ${timestamp} - ${shortUuid}`;
          
          const { data: newProject, error: projectError } = await supabase
            .from('projects')
            .insert({
              title: projectTitle,
              description: 'Automatically created from Ad Wizard',
              user_id: user.id,
              business_idea: businessIdea,
              target_audience: targetAudience,
              audience_analysis: audienceAnalysis,
              generated_ads: newAds.map(ad => ({
                ...ad,
                platform: ad.platform || 'facebook',
                id: ad.id || crypto.randomUUID(),
                size: ad.size || {
                  width: 1200,
                  height: 628,
                  label: `${ad.platform || 'facebook'} Feed`
                }
              })),
              status: 'draft'
            })
            .select()
            .single();

          if (projectError) {
            console.error('[AdWizard] Error creating project:', projectError);
            throw projectError;
          }

          if (newProject) {
            navigate(`/ad-wizard/${newProject.id}`);
          }
        } else {
          // Update existing project
          const { error: updateError } = await supabase
            .from('projects')
            .update({ 
              generated_ads: newAds.map(ad => ({
                ...ad,
                platform: ad.platform || 'facebook',
                id: ad.id || crypto.randomUUID(),
                size: ad.size || {
                  width: 1200,
                  height: 628,
                  label: `${ad.platform || 'facebook'} Feed`
                }
              })),
              business_idea: businessIdea,
              target_audience: targetAudience,
              audience_analysis: audienceAnalysis,
              updated_at: new Date().toISOString()
            })
            .eq('id', projectId);

          if (updateError) {
            console.error('[AdWizard] Error updating project ads:', updateError);
            throw updateError;
          }
        }

        // Also update wizard_progress
        const { error: progressError } = await supabase
          .from('wizard_progress')
          .upsert({
            user_id: user.id,
            generated_ads: newAds.map(ad => ({
              ...ad,
              platform: ad.platform || 'facebook',
              id: ad.id || crypto.randomUUID(),
              size: ad.size || {
                width: 1200,
                height: 628,
                label: `${ad.platform || 'facebook'} Feed`
              }
            })),
            business_idea: businessIdea,
            target_audience: targetAudience,
            audience_analysis: audienceAnalysis
          }, {
            onConflict: 'user_id'
          });

        if (progressError) {
          console.error('[AdWizard] Error updating wizard progress:', progressError);
        }
      } else if (sessionId) {
        console.log('[AdWizard] Saving ads for anonymous user');
        const { error: anonymousError } = await supabase
          .from('anonymous_usage')
          .upsert({
            session_id: sessionId,
            used: true,
            wizard_data: {
              business_idea: businessIdea,
              target_audience: targetAudience,
              generated_ads: newAds.map(ad => ({
                ...ad,
                platform: ad.platform || 'facebook',
                id: ad.id || crypto.randomUUID(),
                size: ad.size || {
                  width: 1200,
                  height: 628,
                  label: `${ad.platform || 'facebook'} Feed`
                }
              }))
            },
            completed: true
          }, {
            onConflict: 'session_id'
          });

        if (anonymousError) {
          console.error('[AdWizard] Error saving anonymous ads:', anonymousError);
          throw anonymousError;
        }
      }
    } catch (error: any) {
      console.error('[AdWizard] Error in handleAdsGenerated:', error);
      toast({
        title: "Couldn't save your ads",
        description: "Your ads were generated but we couldn't save them. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartOverWithReset = async () => {
    console.log('[AdWizard] Starting over with full reset');
    setGeneratedAds([]); // Clear generated ads
    setHasLoadedInitialAds(false); // Reset loading state
    
    // Clear wizard progress in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('wizard_progress')
          .update({
            business_idea: null,
            target_audience: null,
            audience_analysis: null,
            generated_ads: null,
            current_step: 1
          })
          .eq('user_id', user.id);

        if (error) {
          console.error('[AdWizard] Error clearing wizard progress:', error);
        }
      }
    } catch (error) {
      console.error('[AdWizard] Error in handleStartOverWithReset:', error);
    }

    handleStartOver(); // Call original handleStartOver from useAdWizardState
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
        if (!currentUser) {
          return <RegistrationWall onBack={handleBack} />;
        }
        return businessIdea && targetAudience && audienceAnalysis ? (
          <AdGalleryStep
            businessIdea={businessIdea}
            targetAudience={targetAudience}
            adHooks={selectedHooks}
            onStartOver={handleStartOverWithReset}
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
  }, [currentStep, businessIdea, targetAudience, audienceAnalysis, selectedHooks, videoAdsEnabled, generatedAds, hasLoadedInitialAds, currentUser]);

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