import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./feedback/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdFeedbackControlsProps {
  adId: string;
  projectId?: string;
  onFeedbackSubmit?: () => void;
}

export const AdFeedbackControls = ({ adId, projectId, onFeedbackSubmit }: AdFeedbackControlsProps) => {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
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
        rating,
        feedback,
        ...(projectId && projectId !== 'new' ? { project_id: projectId } : {})
      };

      const { error } = await supabase
        .from('ad_feedback')
        .insert(feedbackData);

      if (error) throw error;

      toast({
        title: "Feedback Saved",
        description: "Thank you for your feedback!",
      });

      // Reset form
      setRating(0);
      setFeedback("");
      
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
      <div className="space-y-2">
        <label className="text-sm font-medium">Rating</label>
        <StarRating
          rating={rating}
          onRate={setRating}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Feedback</label>
        <Textarea
          placeholder="Share your thoughts about this ad..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="min-h-[100px]"
        />
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