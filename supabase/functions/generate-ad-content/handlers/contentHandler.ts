import { generateCampaign } from "./campaignGeneration.ts";
import { generatePlatformSpecificContent } from "./platformContent.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export const handleCompleteAdsGeneration = async (
  businessIdea: any,
  targetAudience: any,
  platform: string,
  numVariants: number,
  isAnonymous: boolean,
  sessionId: string | undefined,
  supabaseAdmin: ReturnType<typeof createClient>
) => {
  try {
    console.log('[generate-ad-content] Starting generation with:', { 
      businessIdea, 
      targetAudience, 
      platform 
    });

    // Validate inputs
    if (!businessIdea || !targetAudience) {
      throw new Error('Business idea and target audience are required');
    }

    console.log('[generate-ad-content] Generating campaign for platform:', platform);
    const campaignData = await generateCampaign(businessIdea, targetAudience, platform);
    
    const { imageData, format } = await generatePlatformSpecificContent(
      platform,
      businessIdea,
      targetAudience,
      campaignData
    );

    const variants = Array.from({ length: numVariants }, (_, index) => ({
      id: crypto.randomUUID(),
      platform,
      headline: campaignData.campaign.headlines[index % campaignData.campaign.headlines.length],
      description: campaignData.campaign.adCopies[index % campaignData.campaign.adCopies.length].content,
      imageUrl: imageData.images[0]?.url,
      size: format
    }));

    if (isAnonymous && sessionId) {
      const { error: updateError } = await supabaseAdmin
        .from('anonymous_usage')
        .update({
          used: true,
          wizard_data: {
            business_idea: businessIdea,
            target_audience: targetAudience,
            generated_ads: variants
          },
          completed: true
        })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('[generate-ad-content] Error updating anonymous usage:', updateError);
      }
    }

    return { variants };
  } catch (error) {
    console.error('[generate-ad-content] Error in handleCompleteAdsGeneration:', error);
    throw error;
  }
};