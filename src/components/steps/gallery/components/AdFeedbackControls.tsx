import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FeedbackDialog } from "./feedback/FeedbackDialog";
import { StarRating } from "./feedback/StarRating";
import { LikeDislikeButtons } from "./feedback/LikeDislikeButtons";

interface AdFeedbackControlsProps {
  adId: string;
  projectId?: string;
  onFeedbackSubmit?: () => void;
}

export const AdFeedbackControls = ({ 
  adId, 
  projectId, 
  onFeedbackSubmit 
}: AdFeedbackControlsProps) => {
  const [rating, setRating] = useState<number | null>(null);
  const [starRating, setStarRating] = useState<number>(0);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleStarClick = async (stars: number) => {
    if (isSubmitting) {
      console.log('[AdFeedbackControls] Submission in progress, preventing duplicate');
      return;
    }
    
    setIsSubmitting(true);
    console.log('[AdFeedbackControls] Starting star rating submission');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to provide feedback",
          variant: "destructive",
        });
        return;
      }

      const isValidUUID = projectId && 
                         projectId !== "new" && 
                         /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

      const { error } = await supabase
        .from('ad_feedback')
        .upsert({
          user_id: user.id,
          project_id: isValidUUID ? projectId : null,
          ad_id: adId,
          rating: stars,
          feedback: null
        });

      if (error) throw error;

      setStarRating(stars);
      onFeedbackSubmit?.();

      toast({
        title: "Rating saved",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('[AdFeedbackControls] Error saving star rating:', error);
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log('[AdFeedbackControls] Star rating submission completed');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (isSubmitting) {
      console.log('[AdFeedbackControls] Submission in progress, preventing duplicate');
      return;
    }
    
    setIsSubmitting(true);
    console.log('[AdFeedbackControls] Starting feedback submission');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to provide feedback",
          variant: "destructive",
        });
        return;
      }

      const isValidUUID = projectId && 
                         projectId !== "new" && 
                         /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

      const { error } = await supabase
        .from('ad_feedback')
        .upsert({
          user_id: user.id,
          project_id: isValidUUID ? projectId : null,
          ad_id: adId,
          rating: 0,
          feedback: feedbackText
        });

      if (error) throw error;

      setShowFeedbackDialog(false);
      setFeedbackText("");
      onFeedbackSubmit?.();

      toast({
        title: "Feedback saved",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('[AdFeedbackControls] Error saving feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log('[AdFeedbackControls] Feedback submission completed');
    }
  };

  const handleLike = async () => {
    if (isSubmitting) {
      console.log('[AdFeedbackControls] Submission in progress, preventing duplicate');
      return;
    }
    
    setIsSubmitting(true);
    console.log('[AdFeedbackControls] Starting like submission');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to provide feedback",
          variant: "destructive",
        });
        return;
      }

      const isValidUUID = projectId && 
                         projectId !== "new" && 
                         /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

      const { error } = await supabase
        .from('ad_feedback')
        .upsert({
          user_id: user.id,
          project_id: isValidUUID ? projectId : null,
          ad_id: adId,
          rating: 1,
          feedback: null
        });

      if (error) throw error;

      setRating(1);
      onFeedbackSubmit?.();

      toast({
        title: "Feedback saved",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('[AdFeedbackControls] Error saving feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log('[AdFeedbackControls] Like submission completed');
    }
  };

  const handleDislike = () => {
    setRating(0);
    setShowFeedbackDialog(true);
  };

  return (
    <>
      <div className="flex items-center justify-between space-x-2">
        <LikeDislikeButtons
          rating={rating}
          onLike={handleLike}
          onDislike={handleDislike}
          disabled={isSubmitting}
        />
        <StarRating 
          rating={starRating} 
          onRate={handleStarClick}
          disabled={isSubmitting} 
        />
      </div>

      <FeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        feedbackText={feedbackText}
        onFeedbackChange={setFeedbackText}
        onSubmit={handleFeedbackSubmit}
        disabled={isSubmitting}
      />
    </>
  );
};