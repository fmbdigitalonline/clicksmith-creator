import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateAudiences } from "./handlers/audienceGeneration.ts";
import { generateHooks } from "./handlers/hookGeneration.ts";
import { generateImagePrompts } from "./handlers/imagePromptGeneration.ts";
import { generateCampaign } from "./handlers/campaignGeneration.ts";
import { analyzeAudience } from "./handlers/audienceAnalysis.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const PLATFORM_FORMATS = {
  facebook: { width: 1200, height: 628, label: "Facebook Feed" },
  google: { width: 1200, height: 628, label: "Google Display" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn Feed" },
  tiktok: { width: 1080, height: 1920, label: "TikTok Feed" }
};

serve(async (req) => {
  console.log('[generate-ad-content] Function started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[generate-ad-content] Handling OPTIONS request');
    return new Response(null, { 
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body;
    try {
      const text = await req.text();
      console.log('[generate-ad-content] Raw request body:', text);
      body = JSON.parse(text);
      console.log('[generate-ad-content] Parsed request body:', body);
    } catch (e) {
      console.error('[generate-ad-content] Error parsing request body:', e);
      throw new Error(`Invalid JSON in request body: ${e.message}`);
    }

    if (!body) {
      console.error('[generate-ad-content] Empty request body');
      throw new Error('Empty request body');
    }

    const { type, businessIdea, targetAudience, platform = 'facebook', isAnonymous, sessionId } = body;
    let userId = null;

    console.log('[generate-ad-content] Request details:', {
      type,
      platform,
      isAnonymous,
      sessionId,
      hasBusinessIdea: !!businessIdea,
      hasTargetAudience: !!targetAudience
    });

    // Handle anonymous users with service role privileges
    if (isAnonymous && sessionId) {
      console.log('[generate-ad-content] Processing anonymous request:', { sessionId });
      
      // Use service role client to check anonymous usage
      const { data: anonymousUsage, error: usageError } = await supabaseAdmin
        .from('anonymous_usage')
        .select('used, completed')
        .eq('session_id', sessionId)
        .single();

      if (usageError) {
        console.error('[generate-ad-content] Error checking anonymous usage:', usageError);
        throw new Error(`Error checking anonymous usage: ${usageError.message}`);
      }

      console.log('[generate-ad-content] Anonymous usage status:', anonymousUsage);

      if (anonymousUsage?.completed) {
        console.log('[generate-ad-content] Anonymous session already completed');
        throw new Error('Anonymous trial has been completed. Please sign up to continue.');
      }

      // Update anonymous usage with service role
      if (!anonymousUsage?.used) {
        const { error: updateError } = await supabaseAdmin
          .from('anonymous_usage')
          .update({ used: true })
          .eq('session_id', sessionId);

        if (updateError) {
          console.error('[generate-ad-content] Error updating anonymous usage:', updateError);
          throw new Error(`Error updating anonymous usage: ${updateError.message}`);
        }
      }
    } else if (!isAnonymous) {
      // Handle authenticated users
      try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
          );
          if (userError) throw userError;
          userId = user?.id;
        }
      } catch (error) {
        console.error('[generate-ad-content] Error getting user:', error);
        throw error;
      }
    }

    // Process the request based on type
    let responseData;
    console.log('[generate-ad-content] Processing request type:', type);
    
    switch (type) {
      case 'complete_ads':
      case 'video_ads': {
        console.log('[generate-ad-content] Generating campaign for platform:', platform);
        const campaignData = await generateCampaign(businessIdea, targetAudience);
        const imageData = await generateImagePrompts(businessIdea, targetAudience, campaignData.campaign);
        
        const variants = Array.from({ length: 10 }, (_, index) => {
          const format = PLATFORM_FORMATS[platform as keyof typeof PLATFORM_FORMATS];
          return {
            id: crypto.randomUUID(),
            platform,
            headline: campaignData.campaign.headlines[index % campaignData.campaign.headlines.length],
            description: campaignData.campaign.adCopies[index % campaignData.campaign.adCopies.length].content,
            imageUrl: imageData.images[0]?.url,
            size: format
          };
        });

        console.log('[generate-ad-content] Generated variants count:', variants.length);
        responseData = { variants };
        break;
      }
      case 'audience':
        responseData = await generateAudiences(businessIdea);
        break;
      case 'hooks':
        responseData = await generateHooks(businessIdea, targetAudience);
        break;
      case 'audience_analysis':
        responseData = await analyzeAudience(businessIdea, targetAudience);
        break;
      default:
        console.error('[generate-ad-content] Unsupported generation type:', type);
        throw new Error(`Unsupported generation type: ${type}`);
    }

    console.log('[generate-ad-content] Successfully generated response');
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[generate-ad-content] Error in function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }), {
        status: error.status || 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});