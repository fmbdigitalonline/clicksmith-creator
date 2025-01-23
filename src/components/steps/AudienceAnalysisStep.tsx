import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BusinessIdea, TargetAudience, AudienceAnalysis } from "@/types/adWizard";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface AudienceAnalysisStepProps {
  businessIdea: BusinessIdea;
  targetAudience: TargetAudience;
  onNext: (analysis: AudienceAnalysis) => void;
  onBack: () => void;
}

const AudienceAnalysisStep = ({
  businessIdea,
  targetAudience,
  onNext,
  onBack,
}: AudienceAnalysisStepProps) => {
  const [analysis, setAnalysis] = useState<AudienceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [regenerationCount, setRegenerationCount] = useState(0);
  const { toast } = useToast();

  const generateAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ad-content', {
        body: { 
          type: 'audience_analysis',
          businessIdea,
          targetAudience,
          regenerationCount: regenerationCount,
          timestamp: new Date().getTime()
        }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      setRegenerationCount(prev => prev + 1);
      
      toast({
        title: "Fresh Analysis Generated!",
        description: "New deep audience analysis has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating analysis:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate audience analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!analysis) {
      generateAnalysis();
    }
  }, []);

  const handleNext = async () => {
    if (analysis) {
      setIsTransitioning(true);
      try {
        // Add a small delay to ensure smooth transition animation
        await new Promise(resolve => setTimeout(resolve, 300));
        onNext(analysis);
      } finally {
        setIsTransitioning(false);
      }
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isTransitioning}
          className="space-x-2 w-full md:w-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous Step</span>
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={generateAnalysis}
            disabled={isLoading || isTransitioning}
            variant="outline"
            className="w-full md:w-auto"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            <span>Regenerate Analysis</span>
          </Button>
          <Button
            onClick={handleNext}
            disabled={!analysis || isLoading || isTransitioning}
            className="bg-facebook hover:bg-facebook/90 text-white w-full md:w-auto relative animate-in fade-in duration-300"
          >
            {isTransitioning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl md:text-2xl font-semibold mb-2">Deep Audience Analysis</h2>
        <p className="text-gray-600">
          Understanding your audience's needs, desires, and objections.
        </p>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-facebook" />
            <p className="text-gray-600">Analyzing your target audience...</p>
          </div>
        </Card>
      ) : analysis ? (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Expanded Definition</CardTitle>
              <CardDescription>A more accurate definition of your chosen audience</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{analysis.expandedDefinition}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Analysis</CardTitle>
              <CardDescription>Understanding the market situation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-facebook mb-2">Market Desire</h4>
                <p className="text-gray-700">{analysis.marketDesire}</p>
              </div>
              <div>
                <h4 className="font-medium text-facebook mb-2">Awareness Level</h4>
                <p className="text-gray-700">{analysis.awarenessLevel}</p>
              </div>
              <div>
                <h4 className="font-medium text-facebook mb-2">Sophistication Level</h4>
                <p className="text-gray-700">{analysis.sophisticationLevel}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deep Pain Points</CardTitle>
              <CardDescription>Main problems your audience is facing</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.deepPainPoints.map((point, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-facebook font-medium">{index + 1}.</span>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Potential Objections</CardTitle>
              <CardDescription>Common concerns and hesitations</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.potentialObjections.map((objection, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-facebook font-medium">{index + 1}.</span>
                    <span className="text-gray-700">{objection}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default AudienceAnalysisStep;