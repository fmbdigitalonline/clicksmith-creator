import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BusinessIdea, TargetAudience, AudienceAnalysis, MarketingCampaign } from "@/types/adWizard";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface CampaignStepProps {
  businessIdea: BusinessIdea;
  targetAudience: TargetAudience;
  audienceAnalysis: AudienceAnalysis;
  onNext: (campaign: MarketingCampaign) => void;
  onBack: () => void;
}

const CampaignStep = ({
  businessIdea,
  targetAudience,
  audienceAnalysis,
  onNext,
  onBack,
}: CampaignStepProps) => {
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateCampaign = async () => {
    console.log('Starting campaign generation with:', {
      businessIdea,
      targetAudience,
      audienceAnalysis
    });
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: { 
          type: 'campaign',
          businessIdea,
          targetAudience,
          audienceAnalysis
        }
      });

      if (error) {
        console.error('Error from generate-ad-content:', error);
        throw error;
      }

      console.log('Campaign generation response:', data);

      if (!data?.campaign) {
        throw new Error('Invalid response format from server');
      }

      setCampaign(data.campaign);
      toast({
        title: "Campaign Generated!",
        description: "Marketing campaign has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating campaign:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate marketing campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!campaign) {
      generateCampaign();
    }
  }, []);

  const handleNext = () => {
    if (campaign) {
      onNext(campaign);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="space-x-2 w-full md:w-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous Step</span>
        </Button>
        <Button
          onClick={handleNext}
          disabled={!campaign || isLoading}
          className="bg-facebook hover:bg-facebook/90 text-white w-full md:w-auto"
        >
          <span>Next Step</span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4 ml-2" />
          )}
        </Button>
      </div>

      <div>
        <h2 className="text-xl md:text-2xl font-semibold mb-2">Marketing Campaign</h2>
        <p className="text-gray-600">
          Generated marketing angles, hooks, ad copies, and headlines based on your audience analysis.
        </p>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-facebook" />
            <p className="text-gray-600">Generating your marketing campaign...</p>
          </div>
        </Card>
      ) : campaign ? (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Marketing Angles & Hooks</CardTitle>
              <CardDescription>Different approaches to reach your audience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaign.angles.map((angle, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-facebook mb-2">Angle {index + 1}</p>
                    <p className="text-gray-700 mb-2">{angle.description}</p>
                    <p className="text-sm text-gray-600 italic">Hook: "{angle.hook}"</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ad Copies</CardTitle>
              <CardDescription>Different versions of your ad content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaign.adCopies.map((copy, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-facebook mb-2">
                      {copy.type === 'story' ? 'Story-based Version' : 
                       copy.type === 'short' ? 'Short Impact Version' : 
                       'AIDA Framework Version'}
                    </p>
                    <p className="text-gray-700 whitespace-pre-line">{copy.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Headlines</CardTitle>
              <CardDescription>Attention-grabbing headlines for your ads (6 words max)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaign.headlines.map((headline, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-facebook mb-2">Headline {index + 1}</p>
                    <p className="text-gray-700">{headline}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default CampaignStep;