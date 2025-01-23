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
  
  if (req.method === 'OPTIONS') {
    console.log('[generate-ad-content] Handling OPTIONS request');
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('[generate-ad-content] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey,
      urlLength: supabaseUrl?.length,
      keyLength: supabaseServiceRoleKey?.length
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables for Supabase client');
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          flowType: 'pkce'
        },
        global: {
          headers: { 
            'X-Client-Info': 'generate-ad-content-edge-function',
            'X-Initial-Auth': 'service_role'
          },
          fetch: fetch
        }
      }
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

    const { type, businessIdea, targetAudience, platform = 'facebook', userId, sessionId, isAnonymous, numVariants = 10 } = body;

    console.log('[generate-ad-content] Request details:', {
      type,
      platform,
      userId,
      sessionId,
      isAnonymous,
      hasBusinessIdea: !!businessIdea,
      hasTargetAudience: !!targetAudience,
      numVariants
    });

    if (isAnonymous && sessionId) {
      console.log('[generate-ad-content] Processing anonymous request:', { 
        sessionId,
        headers: req.headers,
        requestPath: new URL(req.url).pathname
      });
      
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
    }

    if (userId && !isAnonymous && type !== 'audience_analysis') {
      console.log('[generate-ad-content] Checking credits for user:', userId);
      
      const { data: creditCheck, error: creditError } = await supabaseAdmin.rpc(
        'check_user_credits',
        { p_user_id: userId, required_credits: 1 }
      );

      if (creditError) {
        console.error('[generate-ad-content] Credit check error:', creditError);
        throw creditError;
      }

      const result = creditCheck[0];
      console.log('[generate-ad-content] Credit check result:', result);
      
      if (!result.has_credits) {
        return new Response(
          JSON.stringify({ error: 'No credits available', message: result.error_message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }

      const { error: deductError } = await supabaseAdmin.rpc(
        'deduct_user_credits',
        { input_user_id: userId, credits_to_deduct: 1 }
      );

      if (deductError) {
        console.error('[generate-ad-content] Credit deduction error:', deductError);
        throw deductError;
      }
    }

    let responseData;
    console.log('[generate-ad-content] Processing request type:', type);
    
    switch (type) {
      case 'complete_ads':
      case 'video_ads': {
        console.log('[generate-ad-content] Generating campaign for platform:', platform);
        const campaignData = await generateCampaign(businessIdea, targetAudience);
        const imageData = await generateImagePrompts(businessIdea, targetAudience, campaignData.campaign);
        
        const format = PLATFORM_FORMATS[platform as keyof typeof PLATFORM_FORMATS];
        if (!format) {
          throw new Error(`Unsupported platform: ${platform}`);
        }

        const variants = Array.from({ length: numVariants }, (_, index) => ({
          id: crypto.randomUUID(),
          platform,
          headline: campaignData.campaign.headlines[index % campaignData.campaign.headlines.length],
          description: campaignData.campaign.adCopies[index % campaignData.campaign.adCopies.length].content,
          imageUrl: imageData.images[0]?.url,
          size: format
        }));

        console.log(`[generate-ad-content] Generated ${variants.length} variants for ${platform}`);

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
