import React from 'react';
import { Button } from "@/components/ui/button";
import { Ad } from '@/types/ad';

interface GeneratedAdsProps {
  ads: Ad[];
  onBack: () => void;
  isLoading: boolean;
  hasLoadedInitialAds: boolean;
}

export const GeneratedAds: React.FC<GeneratedAdsProps> = ({
  ads,
  onBack,
  isLoading,
  hasLoadedInitialAds,
}) => {
  return (
    <div className="space-y-4">
      {isLoading ? (
        <div>Loading ads...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ads.map((ad, index) => (
            <div key={index} className="border p-4 rounded">
              <h3 className="font-bold">{ad.title}</h3>
              <p>{ad.description}</p>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" onClick={onBack}>Back</Button>
    </div>
  );
};