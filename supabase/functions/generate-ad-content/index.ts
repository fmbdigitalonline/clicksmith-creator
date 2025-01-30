import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { handleOptionsRequest, createErrorResponse, createSuccessResponse } from "./utils/responseUtils.ts";
import { checkAndDeductCredits } from "./utils/creditUtils.ts";
import { handleCompleteAdsGeneration } from "./handlers/contentHandler.ts";
import { generateAudiences } from "./handlers/audienceGeneration.ts";
import { generateHooks } from "./handlers/hookGeneration.ts";
import { analyzeAudience } from "./handlers/audienceAnalysis.ts";

serve(async (req) => {
  console.log('[generate-ad-content] Function started');
  
  if (req.method === 'OPTIONS') {
    console.log('[generate-ad-content] Handling OPTIONS request');
    return handleOptionsRequest();
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
      throw new Error('Empty request body');
    }

    const { 
      type, 
      businessIdea, 
      targetAudience, 
      platform = 'facebook', 
      userId, 
      sessionId, 
      isAnonymous, 
      numVariants = 10 
    } = body;

    await checkAndDeductCredits(supabaseAdmin, userId, isAnonymous, sessionId);

    let responseData;
    console.log('[generate-ad-content] Processing request type:', type);
    
    switch (type) {
      case 'complete_ads':
      case 'video_ads': {
        responseData = await handleCompleteAdsGeneration(
          businessIdea,
          targetAudience,
          platform,
          numVariants,
          isAnonymous,
          sessionId,
          supabaseAdmin
        );
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

    console.log('[generate-ad-content] Successfully generated response');
    return createSuccessResponse(responseData);
  } catch (error) {
    if (error.message.includes('No credits available')) {
      return createErrorResponse(error, 402);
    }
    return createErrorResponse(error);
  }
});