import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateAudiences } from "./handlers/audienceGeneration.ts";
import { generateHooks } from "./handlers/hookGeneration.ts";
import { generateImagePrompts } from "./handlers/imagePromptGeneration.ts";
import { generateCampaign } from "./handlers/campaignGeneration.ts";
import { analyzeAudience } from "./handlers/audienceAnalysis.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, businessIdea, targetAudience, regenerationCount, timestamp, forceRegenerate } = await req.json();

    let responseData;

    console.log('Processing request:', { type, timestamp, regenerationCount, forceRegenerate });

    switch (type) {
      case 'audience':
        console.log('Generating audiences with params:', { businessIdea, regenerationCount, timestamp, forceRegenerate });
        responseData = await generateAudiences(businessIdea, regenerationCount, forceRegenerate);
        break;
      case 'hooks':
        console.log('Generating hooks with params:', { businessIdea, targetAudience });
        responseData = await generateHooks(businessIdea, targetAudience);
        break;
      case 'images':
        console.log('Generating image prompts with params:', { businessIdea, targetAudience });
        responseData = await generateImagePrompts(businessIdea, targetAudience);
        break;
      case 'complete':
        console.log('Generating complete ad with params:', { businessIdea, targetAudience });
        responseData = await generateCampaign(businessIdea, targetAudience);
        break;
      case 'analysis':
        console.log('Analyzing audience with params:', { businessIdea, targetAudience });
        responseData = await analyzeAudience(businessIdea, targetAudience);
        break;
      case 'campaign':
        console.log('Generating campaign with params:', { businessIdea, targetAudience });
        responseData = await generateCampaign(businessIdea, targetAudience);
        break;
      default:
        throw new Error(`Unsupported generation type: ${type}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-ad-content function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});