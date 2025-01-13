import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { SavedAdCard } from "./components/SavedAdCard";
import { EmptyState } from "./components/EmptyState";
import { WizardHook, WizardProgressData } from "@/types/wizardProgress";

interface SavedAd {
  id: string;
  saved_images: string[];
  headline?: string;
  primary_text?: string;
  rating: number;
  feedback: string;
  created_at: string;
}

interface AdFeedbackRow {
  id: string;
  saved_images: Json;
  headline?: string;
  primary_text?: string;
  rating: number;
  feedback: string;
  created_at: string;
}

export const SavedAdsGallery = () => {
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSavedAds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // First try to get ads from wizard progress
      const { data: wizardData } = await supabase
        .from('wizard_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let generatedAds: SavedAd[] = [];
      
      if (wizardData?.selected_hooks) {
        const hooksData = Array.isArray(wizardData.selected_hooks) 
          ? (wizardData.selected_hooks as WizardHook[])
          : [];
          
        generatedAds = hooksData
          .filter(hook => hook.imageUrl) // Only include hooks with images
          .map((hook: WizardHook, index: number) => ({
            id: `wizard-${index}`,
            saved_images: hook.imageUrl ? [hook.imageUrl] : [],
            headline: hook.description,
            primary_text: hook.text,
            rating: 0,
            feedback: '',
            created_at: new Date().toISOString()
          }));
      }

      // Then get saved ad feedback
      const { data: feedbackData, error } = await supabase
        .from('ad_feedback')
        .select('*')
        .eq('user_id', user.id)
        .not('saved_images', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Convert feedback data
      const feedbackAds: SavedAd[] = (feedbackData as AdFeedbackRow[])
        .filter(ad => ad.saved_images) // Only include ads with saved_images
        .map(ad => {
          let images: string[] = [];
          if (Array.isArray(ad.saved_images)) {
            images = ad.saved_images.filter((img): img is string => 
              typeof img === 'string' && img.length > 0
            );
          } else if (typeof ad.saved_images === 'string' && ad.saved_images.length > 0) {
            images = [ad.saved_images];
          }
          
          return {
            ...ad,
            saved_images: images
          };
        })
        .filter(ad => ad.saved_images.length > 0); // Only include ads with valid images

      // Combine both sources of ads
      const allAds = [...generatedAds, ...feedbackAds];

      setSavedAds(allAds);
    } catch (error) {
      console.error('Error fetching saved ads:', error);
      toast({
        title: "Error",
        description: "Failed to load saved ads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadAds = async () => {
      if (isMounted) {
        await fetchSavedAds();
      }
    };

    loadAds();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <div>Loading saved ads...</div>;
  }

  if (savedAds.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {savedAds.map((ad) => (
        <SavedAdCard
          key={ad.id}
          id={ad.id}
          primaryText={ad.primary_text}
          headline={ad.headline}
          imageUrl={ad.saved_images[0]}
          onFeedbackSubmit={fetchSavedAds}
        />
      ))}
    </div>
  );
};