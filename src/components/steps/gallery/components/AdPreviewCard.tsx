import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MediaPreview from "./MediaPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}

const AdPreviewCard = ({ variant, onCreateProject, isVideo = false, selectedFormat }: AdPreviewCardProps) => {
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
        {/* Primary Text Section - First */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">Primary Text:</p>
          <p className="text-gray-800">{variant.description}</p>
        </div>

        {/* Image Preview - Second */}
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
          {/* Headline Section */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Headline:</p>
            <h3 className="text-lg font-semibold text-facebook">
              {variant.headline}
            </h3>
          </div>

          {/* Download Controls */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select
                value={downloadFormat}
                onValueChange={(value) => setDownloadFormat(value as "jpg" | "png" | "pdf" | "docx")}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpg">JPG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">Word</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            
            <Button
              onClick={handleSave}
              className="w-full bg-facebook hover:bg-facebook/90"
              disabled={isSaving}
            >
              {isSaving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Ad
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default AdPreviewCard;