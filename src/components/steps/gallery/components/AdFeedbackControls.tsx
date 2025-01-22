import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./feedback/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface AdFeedbackControlsProps {
  adId: string;
  projectId?: string;
  onFeedbackSubmit?: () => void;
}

export const AdFeedbackControls = ({ adId, projectId, onFeedbackSubmit }: AdFeedbackControlsProps) => {
  const [rating, setRating] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFeedbackSubmit = async () => {
    if (isSubmitting) return;
    
    if (!rating) {
      toast({
        title: "Rating Required",
        description: "Please provide a rating before submitting feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("You must be logged in to save feedback");
      }

      const feedbackData = {
        user_id: user.id,
        ad_id: adId,
        rating: parseInt(rating, 10),
        ...(projectId && projectId !== 'new' ? { project_id: projectId } : {})
      };

      // First try to update existing feedback
      const { data: existingFeedback, error: updateError } = await supabase
        .from('ad_feedback')
        .upsert(feedbackData, {
          onConflict: 'user_id,ad_id'
        });

      if (updateError) throw updateError;

      toast({
        title: "Feedback Saved",
        description: "Thank you for your feedback!",
      });

      // Reset form
      setRating("");
      
      // Call the callback if provided
      if (onFeedbackSubmit) {
        onFeedbackSubmit();
      }
    } catch (error: any) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-4">
        <Button
          variant={rating === "1" ? "default" : "outline"}
          onClick={() => setRating("1")}
          className="flex-1"
        >
          <ThumbsUp className="w-4 h-4 mr-2" />
          Like
        </Button>
        <Button
          variant={rating === "0" ? "default" : "outline"}
          onClick={() => setRating("0")}
          className="flex-1"
        >
          <ThumbsDown className="w-4 h-4 mr-2" />
          Dislike
        </Button>
      </div>

      <Button
        onClick={handleFeedbackSubmit}
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Saving..." : "Submit Feedback"}
      </Button>
    </div>
  );
};