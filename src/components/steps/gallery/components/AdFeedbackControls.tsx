import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface AdFeedbackControlsProps {
  adId: string;
  projectId?: string;
  onFeedbackSubmit?: () => void;
}

export const AdFeedbackControls = ({ adId, projectId, onFeedbackSubmit }: AdFeedbackControlsProps) => {
  const [rating, setRating] = useState<number | null>(null);
  const [starRating, setStarRating] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const { toast } = useToast();

  const handleStarClick = async (stars: number) => {
    setStarRating(stars);
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

      const feedbackData = {
        user_id: user.id,
        project_id: projectId,
        ad_id: adId,
        rating: stars,
      };

      const { error } = await supabase
        .from('ad_feedback')
        .upsert(feedbackData);

      if (error) throw error;

      toast({
        title: "Rating saved",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Error saving star rating:', error);
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDislike = () => {
    setRating(0);
    setShowFeedbackDialog(true);
  };

  const handleFeedbackSubmit = async () => {
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

      const feedbackData = {
        user_id: user.id,
        project_id: projectId,
        ad_id: adId,
        rating: 0,
        feedback: feedbackText
      };

      const { error } = await supabase
        .from('ad_feedback')
        .upsert(feedbackData);

      if (error) throw error;

      setShowFeedbackDialog(false);
      setFeedbackText("");
      onFeedbackSubmit?.();

      toast({
        title: "Feedback saved",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save feedback. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLike = async () => {
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

      const feedbackData = {
        user_id: user.id,
        project_id: projectId,
        ad_id: adId,
        rating: 1
      };

      const { error } = await supabase
        .from('ad_feedback')
        .upsert(feedbackData);

      if (error) throw error;

      setRating(1);
      onFeedbackSubmit?.();

      toast({
        title: "Feedback saved",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save feedback. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between space-x-2">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLike}
            className={cn(rating === 1 && "bg-green-100")}
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            Like
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDislike}
            className={cn(rating === 0 && "bg-red-100")}
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            Dislike
          </Button>
        </div>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map((stars) => (
            <Button
              key={stars}
              variant="ghost"
              size="sm"
              className={cn(
                "p-0 h-8 w-8",
                starRating >= stars && "text-yellow-400"
              )}
              onClick={() => handleStarClick(stars)}
            >
              <Star className="h-4 w-4" fill={starRating >= stars ? "currentColor" : "none"} />
            </Button>
          ))}
        </div>
      </div>

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
            <DialogDescription>
              Please let us know why you disliked this ad. Your feedback helps us improve.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="What could be improved?"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFeedbackSubmit}>Submit Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};