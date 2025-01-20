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
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body;
    try {
      const text = await req.text();
      console.log('Raw request body:', text);
      body = JSON.parse(text);
      console.log('Parsed request body:', body);
    } catch (e) {
      console.error('Error parsing request body:', e);
      throw new Error(`Invalid JSON in request body: ${e.message}`);
    }

    if (!body) {
      throw new Error('Empty request body');
    }

    const { type, businessIdea, targetAudience, platform = 'facebook', userId, sessionId } = body;

    // Handle anonymous users
    if (!userId && sessionId) {
      console.log('Processing anonymous user request with session:', sessionId);
      const { data: anonymousUsage, error: usageError } = await supabase
        .from('anonymous_usage')
        .select('used')
        .eq('session_id', sessionId)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error checking anonymous usage:', usageError);
        throw usageError;
      }

      if (!anonymousUsage) {
        // Create new anonymous usage record
        const { error: insertError } = await supabase
          .from('anonymous_usage')
          .insert({
            session_id: sessionId,
            used: false
          });

        if (insertError) {
          console.error('Error creating anonymous usage record:', insertError);
          throw insertError;
        }
      } else if (anonymousUsage.used) {
        return new Response(
          JSON.stringify({ 
            error: 'Anonymous trial used',
            message: 'Your trial has been used. Please sign up to continue.'
          }),
          { 
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    let responseData;
    switch (type) {
      case 'complete_ads':
      case 'video_ads': {
        console.log('Generating campaign for platform:', platform);
        const campaignData = await generateCampaign(businessIdea, targetAudience);
        const imageData = await generateImagePrompts(businessIdea, targetAudience, campaignData.campaign);
        
        // Generate 10 unique variants
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

        // Mark anonymous session as used after successful generation
        if (!userId && sessionId) {
          const { error: updateError } = await supabase
            .from('anonymous_usage')
            .update({ used: true })
            .eq('session_id', sessionId);

          if (updateError) {
            console.error('Error updating anonymous usage:', updateError);
          }
        }

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
        throw new Error(`Unsupported generation type: ${type}`);
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in generate-ad-content function:', error);
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