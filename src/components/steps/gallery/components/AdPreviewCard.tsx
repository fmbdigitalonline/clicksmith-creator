import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import MediaPreview from "./MediaPreview";
import { AdSizeSelector } from "./AdSizeSelector";
import { AdFeedbackControls } from "../components/AdFeedbackControls";
import { PrimaryText } from "./preview/PrimaryText";
import { HeadlineSection } from "./preview/HeadlineSection";
import { DownloadSection } from "./preview/DownloadSection";
import { convertImage } from "@/utils/imageUtils";

interface AdPreviewCardProps {
  variant: {
    platform: string;
    image?: {
      url: string;
      prompt: string;
    };
    imageUrl?: string;
    size: {
      width: number;
      height: number;
      label: string;
    };
    headline: string;
    description: string;
    callToAction: string;
    id: string;
  };
  onCreateProject: () => void;
  isVideo?: boolean;
  selectedFormat?: { width: number; height: number; label: string };
  onFormatChange?: (format: { width: number; height: number; label: string }) => void;
}

const AdPreviewCard = ({ 
  variant, 
  onCreateProject, 
  isVideo = false,
  selectedFormat,
  onFormatChange 
}: AdPreviewCardProps) => {
  const [downloadFormat, setDownloadFormat] = useState<"jpg" | "png" | "pdf" | "docx">("jpg");
  const [isSaving, setSaving] = useState(false);
  const { toast } = useToast();
  const { projectId } = useParams();
  const format = selectedFormat || variant.size;

  const getImageUrl = () => {
    if (variant.image?.url) {
      return variant.image.url;
    }
    if (variant.imageUrl) {
      return variant.imageUrl;
    }
    return null;
  };

  const handleDownload = async () => {
    const imageUrl = getImageUrl();
    if (!imageUrl) {
      toast({
        title: "Error",
        description: "No image URL available for download",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const convertedBlob = await convertImage(URL.createObjectURL(blob), downloadFormat, variant);
      const url = URL.createObjectURL(convertedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${variant.platform}-${isVideo ? 'video' : 'ad'}-${format.width}x${format.height}.${downloadFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success!",
        description: `Your ${format.label} ${isVideo ? 'video' : 'ad'} has been downloaded as ${downloadFormat.toUpperCase()}.`,
      });
    } catch (error) {
      console.error('Error downloading:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download file.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User must be logged in to save ad');
      }

      if (projectId === "new" && onCreateProject) {
        onCreateProject();
        return;
      }

      const isValidUUID = projectId && 
                         projectId !== "new" && 
                         /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);

      if (isValidUUID) {
        const { error: saveError } = await supabase
          .from('ad_feedback')
          .insert({
            user_id: user.id,
            project_id: projectId,
            saved_images: [getImageUrl()],
            primary_text: variant.description,
            headline: variant.headline,
            feedback: 'saved'
          });

        if (saveError) throw saveError;

        toast({
          title: "Success!",
          description: "Ad saved successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving ad:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save ad.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-4">
        {onFormatChange && (
          <AdSizeSelector
            selectedFormat={format}
            onFormatChange={onFormatChange}
          />
        )}

        <PrimaryText description={variant.description} />

        <div 
          style={{ 
            aspectRatio: `${format.width}/${format.height}`,
            maxHeight: '600px',
            transition: 'aspect-ratio 0.3s ease-in-out'
          }} 
          className="relative group rounded-lg overflow-hidden"
        >
          <MediaPreview
            imageUrl={getImageUrl()}
            isVideo={isVideo}
            format={format}
          />
        </div>

        <CardContent className="p-4 space-y-4">
          <HeadlineSection headline={variant.headline} />

          <DownloadSection
            downloadFormat={downloadFormat}
            onFormatChange={setDownloadFormat}
            onSave={handleSave}
            onDownload={handleDownload}
            isSaving={isSaving}
          />

          <AdFeedbackControls
            adId={variant.id}
            projectId={projectId}
          />
        </CardContent>
      </div>
    </Card>
  );
};

export default AdPreviewCard;