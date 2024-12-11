import Replicate from 'https://esm.sh/replicate@0.25.1';

interface BusinessIdea {
  description: string;
  valueProposition: string;
}

interface TargetAudience {
  name: string;
  description: string;
  demographics: string;
  painPoints: string[];
  icp: string;
  coreMessage: string;
  positioning: string;
  marketingAngle: string;
  messagingApproach: string;
  marketingChannels: string[];
}

interface MarketingCampaign {
  hooks: Array<{
    text: string;
    description: string;
  }>;
  format: {
    format: string;
    dimensions: {
      width: number;
      height: number;
    };
    aspectRatio: string;
    description: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleImagePromptGeneration(
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  campaign: MarketingCampaign,
  openAIApiKey: string
) {
  console.log('Starting image prompt generation with Replicate...');
  
  const replicateApiToken = Deno.env.get('REPLICATE_API_TOKEN');
  if (!replicateApiToken) {
    throw new Error('REPLICATE_API_TOKEN is required');
  }

  const replicate = new Replicate({
    auth: replicateApiToken,
  });

  const basePrompt = `Generate a professional Facebook ad image that captures this marketing message:
${campaign.hooks.map(hook => hook.description).join('\n')}

Business Context:
${businessIdea.description}
Value Proposition: ${businessIdea.valueProposition}

Target Audience:
${targetAudience.name}
${targetAudience.description}

Style requirements:
- Ultra-realistic, professional photography style
- Clean composition with plenty of empty space for text to be added later
- NO text, words, or letters in the image
- Vibrant, engaging colors
- Maximum 2 people per image
- High-end commercial look
- Perfect for Facebook ads
- Negative prompt: text, words, letters, watermarks, logos`;

  try {
    // Generate prompts based on each selected hook
    const prompts = campaign.hooks.map(hook => {
      return `${basePrompt}\nCreate a visual representation of this hook: "${hook.description}" without using any text, focusing on emotional and visual storytelling.`;
    });

    // If we have less than 6 prompts, add some variations
    while (prompts.length < 6) {
      const randomHook = campaign.hooks[Math.floor(Math.random() * campaign.hooks.length)];
      prompts.push(
        `${basePrompt}\nCreate an alternative visual interpretation of: "${randomHook.description}" focusing on the emotional impact and avoiding any text elements.`
      );
    }

    console.log('Generating images with prompts:', prompts);

    // Generate all images in parallel
    const imagePromises = prompts.map(async (prompt) => {
      try {
        const output = await replicate.run(
          "black-forest-labs/flux-1.1-pro-ultra",
          {
            input: {
              prompt,
              negative_prompt: "text, words, letters, watermarks, logos, labels, signs",
              num_inference_steps: 50,
              guidance_scale: 7.5,
            }
          }
        );

        console.log('Generated image URL:', output);
        
        return {
          url: output,
          prompt: prompt,
        };
      } catch (error) {
        console.error('Error generating individual image:', error);
        throw error;
      }
    });

    const images = await Promise.all(imagePromises);
    console.log(`Successfully generated ${images.length} images`);
    
    return { images };
  } catch (error) {
    console.error('Error in handleImagePromptGeneration:', error);
    throw error;
  }
}