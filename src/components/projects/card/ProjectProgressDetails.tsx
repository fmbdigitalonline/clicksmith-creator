import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Users, ChartBar } from "lucide-react";

interface ProjectProgressDetailsProps {
  businessIdea?: {
    description: string;
    valueProposition: string;
  };
  targetAudience?: any;
  audienceAnalysis?: any;
}

const ProjectProgressDetails = ({ 
  businessIdea, 
  targetAudience, 
  audienceAnalysis 
}: ProjectProgressDetailsProps) => {
  if (!businessIdea && !targetAudience && !audienceAnalysis) return null;

  return (
    <div className="space-y-4">
      {businessIdea && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-facebook" />
            <h3 className="font-medium">Business Idea</h3>
          </div>
          <p className="text-sm text-gray-600">{businessIdea.description}</p>
          {businessIdea.valueProposition && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">Value Proposition</Badge>
              <p className="text-sm text-gray-700 mt-1">{businessIdea.valueProposition}</p>
            </div>
          )}
        </div>
      )}

      {targetAudience && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-facebook" />
            <h3 className="font-medium">Target Audience</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(targetAudience).map(([key, value]) => (
              key !== 'audienceAnalysis' && (
                <div key={key} className="text-sm">
                  <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span className="text-gray-700">{String(value)}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {audienceAnalysis && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ChartBar className="w-4 h-4 text-facebook" />
            <h3 className="font-medium">Audience Analysis</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(audienceAnalysis).map(([key, value]) => (
              <div key={key} className="text-sm">
                <Badge variant="outline" className="mb-1 text-xs">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Badge>
                <p className="text-gray-700">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectProgressDetails;