import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { TargetAudience } from "@/types/adWizard";

interface AudienceCardProps {
  audience: TargetAudience;
  onClick: () => void;
}

const AudienceCard = ({ audience, onClick }: AudienceCardProps) => {
  // Ensure arrays have default values if undefined
  const painPoints = audience.painPoints || [];
  const marketingChannels = audience.marketingChannels || [];

  return (
    <Card
      className="relative group cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-facebook"
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-facebook/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl" />
      <CardHeader>
        <div className="flex items-center space-x-2 mb-2">
          <Users className="w-5 h-5 text-facebook" />
          <CardTitle className="text-lg">{audience.name}</CardTitle>
        </div>
        <CardDescription>{audience.demographics}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm mb-2">{audience.description}</p>
          <div className="space-y-2">
            <p className="text-sm font-medium text-facebook">Pain Points:</p>
            <ul className="text-sm list-disc list-inside text-gray-600 space-y-1">
              {painPoints.map((point, pointIndex) => (
                <li key={`${point}-${pointIndex}`}>{point}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div>
            <p className="text-sm font-medium text-facebook">Ideal Customer Profile:</p>
            <p className="text-sm text-gray-600">{audience.icp}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-facebook">Core Message:</p>
            <p className="text-sm text-gray-600">{audience.coreMessage}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-facebook">Positioning:</p>
            <p className="text-sm text-gray-600">{audience.positioning}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-facebook">Marketing Angle:</p>
            <p className="text-sm text-gray-600">{audience.marketingAngle}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-facebook">Messaging Approach:</p>
            <p className="text-sm text-gray-600">{audience.messagingApproach}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-facebook">Marketing Channels:</p>
            <ul className="text-sm list-disc list-inside text-gray-600">
              {marketingChannels.map((channel, channelIndex) => (
                <li key={`${channel}-${channelIndex}`}>{channel}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AudienceCard;