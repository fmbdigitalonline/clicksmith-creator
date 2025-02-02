import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export const useCreditsManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      console.log('[Credits] Checking credits status');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('[Credits] No user found');
        return null;
      }

      // Special case for admin user
      if (user.email === 'info@fmbonline.nl') {
        console.log('[Credits] Admin user detected - unlimited credits');
        return -1; // Special value for unlimited credits
      }

      try {
        // Check subscription first
        const { data: subscription, error: subError } = await supabase
          .from("subscriptions")
          .select("credits_remaining")
          .eq("user_id", user.id)
          .eq("active", true)
          .maybeSingle();

        if (subError && subError.code !== "PGRST116") {
          console.error('[Credits] Error checking subscription:', subError);
          throw subError;
        }

        if (subscription) {
          console.log('[Credits] Found active subscription:', subscription);
          return subscription.credits_remaining;
        }

        // Check free tier if no subscription
        const { data: freeUsage, error: freeError } = await supabase
          .from("free_tier_usage")
          .select("generations_used")
          .eq("user_id", user.id)
          .maybeSingle();

        if (freeError && freeError.code !== "PGRST116") {
          console.error('[Credits] Error checking free tier:', freeError);
          throw freeError;
        }

        const usedGenerations = freeUsage?.generations_used || 0;
        console.log('[Credits] Free tier usage:', usedGenerations);
        return 12 - usedGenerations; // 12 is free tier limit
      } catch (error) {
        console.error('[Credits] Error in credits check:', error);
        toast({
          title: "Error checking credits",
          description: "Unable to verify credit status. Please try again.",
          variant: "destructive",
        });
        return null;
      }
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const checkCredits = async (required: number = 1) => {
    try {
      console.log('[Credits] Checking credits requirement:', required);
      const { data: creditCheck, error } = await supabase.rpc(
        'check_user_credits',
        { p_user_id: (await supabase.auth.getUser()).data.user?.id, required_credits: required }
      );

      if (error) {
        console.error('[Credits] Credit check error:', error);
        toast({
          title: "Error checking credits",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      const result = creditCheck[0];
      if (!result.has_credits) {
        console.log('[Credits] Insufficient credits:', result.error_message);
        toast({
          title: "Insufficient credits",
          description: result.error_message,
          variant: "destructive",
        });
        navigate('/pricing');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Credits] Unexpected error in credit check:', error);
      toast({
        title: "Error",
        description: "Unable to verify credits. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const refreshCredits = () => {
    queryClient.invalidateQueries({ queryKey: ["credits"] });
  };

  return {
    credits,
    isLoadingCredits,
    checkCredits,
    refreshCredits,
  };
};