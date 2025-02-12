import { generateImagePrompts } from "./imagePromptGeneration.ts";

const PLATFORM_FORMATS = {
  facebook: { 
    width: 1200, 
    height: 628, 
    label: "Facebook Feed",
    imageStyle: "social media advertisement optimized for Facebook feed"
  },
  google: { 
    width: 1200, 
    height: 628, 
    label: "Google Display",
    imageStyle: "professional display advertisement optimized for Google Ads"
  },
  linkedin: { 
    width: 1200, 
    height: 627, 
    label: "LinkedIn Feed",
    imageStyle: "professional business advertisement optimized for LinkedIn"
  },
  tiktok: { 
    width: 1080, 
    height: 1920, 
    label: "TikTok Feed", 
    vertical: true,
    imageStyle: "vertical social media content optimized for TikTok"
  }
};

export const generatePlatformSpecificContent = async (
  platform: string,
  businessIdea: any,
  targetAudience: any,
  campaignData: any
) => {
  console.log(`[generate-ad-content] Generating ${platform}-specific content`);
  
  const format = PLATFORM_FORMATS[platform as keyof typeof PLATFORM_FORMATS];
  if (!format) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const imagePromptOptions = {
    vertical: format.vertical || false,
    style: format.imageStyle,
    width: format.width,
    height: format.height
  };

  const imageData = await generateImagePrompts(
    businessIdea, 
    targetAudience, 
    campaignData.campaign, 
    imagePromptOptions
  );

  return { imageData, format };
};