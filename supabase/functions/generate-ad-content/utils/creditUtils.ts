import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export const checkAndDeductCredits = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | undefined,
  isAnonymous: boolean,
  sessionId: string | undefined
) => {
  if (isAnonymous && sessionId) {
    console.log('[generate-ad-content] Processing anonymous request:', { sessionId });
    
    const { data: anonymousUsage, error: usageError } = await supabaseAdmin
      .from('anonymous_usage')
      .select('used, completed')
      .eq('session_id', sessionId)
      .single();

    if (usageError) {
      console.error('[generate-ad-content] Error checking anonymous usage:', usageError);
      throw new Error(`Error checking anonymous usage: ${usageError.message}`);
    }

    if (anonymousUsage?.completed) {
      console.log('[generate-ad-content] Anonymous session already completed');
      throw new Error('Anonymous trial has been completed. Please sign up to continue.');
    }
    
    return;
  }

  if (userId) {
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
      throw new Error('No credits available');
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
};