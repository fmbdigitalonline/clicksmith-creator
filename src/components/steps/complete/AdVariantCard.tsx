import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { AdHook, AdImage } from "@/types/adWizard";
import AdFeedbackForm from "./AdFeedbackForm";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AdVariantCardProps {
  image: AdImage;
  hook: AdHook;
  index: number;
}

const AdVariantCard = ({ image, hook, index }: AdVariantCardProps) => {
  const [isSaving, setSaving] = useState(false);
  const [rating, setRating] = useState("");
  const [feedback, setFeedback] = useState("");
  const { toast } = useToast();

  const handleSaveAndDownload = async () => {
    if (!rating) {
      toast({
        title: "Rating Required",
        description: "Please provide a rating before saving.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User must be logged in to save feedback');
      }

      const { error: feedbackError } = await supabase
        .from('ad_feedback')
        .insert({
          user_id: user.id,
          rating: parseInt(rating),
          feedback,
          saved_images: [image]
        });

      if (feedbackError) throw feedbackError;

      const link = document.createElement('a');
      link.href = image.url;
      link.download = `ad-variant-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success!",
        description: "Your feedback has been saved and image downloaded.",
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save feedback or download image.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video relative">
        <img
          src={image.url}
          alt={`Ad variant ${index + 1}`}
          className="object-cover w-full h-full"
        />
      </div>
      <CardContent className="p-4 space-y-4">
        <h3 className="font-medium text-lg">Variant {index + 1}</h3>
        <div className="space-y-2">
          <p className="text-gray-800 font-medium">{hook.description}</p>
          <p className="text-facebook font-semibold">{hook.text}</p>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <AdFeedbackForm
            rating={rating}
            feedback={feedback}
            onRatingChange={setRating}
            onFeedbackChange={setFeedback}
          />

          <Button
            onClick={handleSaveAndDownload}
            className="w-full bg-facebook hover:bg-facebook/90"
            disabled={isSaving}
          >
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Save & Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdVariantCard;