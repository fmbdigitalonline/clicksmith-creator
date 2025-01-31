import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SavedAdsList } from "./components/SavedAdsList";
import { EmptyState } from "./components/EmptyState";
import { SavedAd, AdFeedbackRow } from "./types";
import { Loader2 } from "lucide-react";

export const SavedAdsGallery = () => {
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSavedAds = async () => {
    try {
      console.log("[SavedAdsGallery] Starting to fetch saved ads...");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("[SavedAdsGallery] Error fetching user:", userError);
        throw userError;
      }

      if (!user) {
        console.log("[SavedAdsGallery] No authenticated user found");
        setIsLoading(false);
        return;
      }

      console.log("[SavedAdsGallery] Authenticated user found:", user.id);

      const { data: feedbackData, error: feedbackError } = await supabase
        .from('ad_feedback')
        .select('*')
        .eq('user_id', user.id)
        .not('saved_images', 'is', null)
        .order('created_at', { ascending: false });

      if (feedbackError) {
        console.error('[SavedAdsGallery] Error fetching feedback data:', feedbackError);
        throw feedbackError;
      }

      console.log("[SavedAdsGallery] Raw feedback data:", feedbackData);

      // Improved data processing with validation
      const feedbackAds: SavedAd[] = (feedbackData || [])
        .filter((ad: AdFeedbackRow) => {
          // Ensure we have valid saved_images data
          const hasValidImages = ad.saved_images !== null && 
            (Array.isArray(ad.saved_images) ? ad.saved_images.length > 0 : 
             typeof ad.saved_images === 'string' && ad.saved_images.length > 0);
          
          if (!hasValidImages) {
            console.warn('[SavedAdsGallery] Skipping ad with invalid images:', ad.id);
          }
          return hasValidImages;
        })
        .map((ad: AdFeedbackRow) => {
          // Process saved_images more carefully
          let images: string[] = [];
          if (Array.isArray(ad.saved_images)) {
            images = ad.saved_images.filter((img): img is string => 
              typeof img === 'string' && img.length > 0
            );
          } else if (typeof ad.saved_images === 'string' && ad.saved_images.length > 0) {
            images = [ad.saved_images];
          }
          
          return {
            id: ad.id,
            saved_images: images,
            headline: ad.headline || '',
            primary_text: ad.primary_text || '',
            rating: ad.rating || 0,
            feedback: ad.feedback || '',
            created_at: ad.created_at
          };
        });

      console.log("[SavedAdsGallery] Processed feedback ads:", feedbackAds);
      setSavedAds(feedbackAds);
      setError(null);
    } catch (error) {
      console.error('[SavedAdsGallery] Error in fetchSavedAds:', error);
      setError('Failed to load saved ads. Please try again.');
      toast({
        title: "Error Loading Ads",
        description: error instanceof Error ? error.message : "Failed to load saved ads. Please try again.",
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
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={fetchSavedAds}
          className="mt-4 text-facebook hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (savedAds.length === 0) {
    return <EmptyState />;
  }

  return <SavedAdsList ads={savedAds} onFeedbackSubmit={fetchSavedAds} />;
};