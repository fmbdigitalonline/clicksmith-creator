import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleAudienceGeneration } from './handlers/audienceGeneration.ts';
import { handleAudienceAnalysis } from './handlers/audienceAnalysis.ts';
import { handleCampaignGeneration } from './handlers/campaignGeneration.ts';
import { handleImagePromptGeneration } from './handlers/imagePromptGeneration.ts';
import { handleHookGeneration } from './handlers/hookGeneration.ts';
import { handleCompleteAdGeneration } from './handlers/completeAdGeneration.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the JWT token from the request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user ID from the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('Processing request for user:', user.id);

    const { type, businessIdea, targetAudience, audienceAnalysis, campaign } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    console.log('Received request type:', type);

    // Validate the type parameter
    const validTypes = ['audience', 'audience_analysis', 'campaign', 'hooks', 'images', 'complete_ads', 'video_ads'];
    if (!validTypes.includes(type)) {
      console.error('Invalid type received:', type);
      throw new Error(`Invalid generation type. Must be one of: ${validTypes.join(', ')}`);
    }

    let result;
    switch (type) {
      case 'audience':
        if (!businessIdea) throw new Error('Business idea is required for audience generation');
        result = await handleAudienceGeneration(businessIdea, openAIApiKey);
        break;
      case 'audience_analysis':
        if (!businessIdea || !targetAudience) throw new Error('Business idea and target audience are required for analysis');
        result = await handleAudienceAnalysis(businessIdea, targetAudience, openAIApiKey);
        break;
      case 'campaign':
        if (!businessIdea || !targetAudience || !audienceAnalysis) 
          throw new Error('Business idea, target audience, and analysis are required for campaign generation');
        result = await handleCampaignGeneration(businessIdea, targetAudience, audienceAnalysis, openAIApiKey);
        break;
      case 'hooks':
        if (!businessIdea || !targetAudience) 
          throw new Error('Business idea and target audience are required for hook generation');
        result = await handleHookGeneration(businessIdea, targetAudience, openAIApiKey);
        break;
      case 'images':
        if (!businessIdea || !targetAudience || !campaign) 
          throw new Error('Business idea, target audience, and campaign are required for image generation');
        result = await handleImagePromptGeneration(businessIdea, targetAudience, campaign, openAIApiKey);
        break;
      case 'complete_ads':
      case 'video_ads':
        if (!businessIdea || !targetAudience || !campaign) 
          throw new Error('Business idea, target audience, and campaign are required for ad generation');
        result = await handleCompleteAdGeneration(businessIdea, targetAudience, campaign, openAIApiKey);
        break;
      default:
        throw new Error('Invalid generation type');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-ad-content function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});