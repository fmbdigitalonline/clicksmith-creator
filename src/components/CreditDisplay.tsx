import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

export const CreditDisplay = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      console.log('[Credits] Checking subscription for user:', user.id);
      
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error('[Credits] Error checking subscription:', error);
        toast({
          title: "Error checking subscription",
          description: "We couldn't verify your subscription status. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      console.log('[Credits] Found subscription:', data);
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 30000, // Only refetch every 30 seconds
  });

  const { data: freeUsage } = useQuery({
    queryKey: ["free_tier_usage", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('[Credits] Checking free tier usage for user:', user.id);
      
      const { data: existingData, error: fetchError } = await supabase
        .from("free_tier_usage")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error('[Credits] Error fetching free tier usage:', fetchError);
        toast({
          title: "Error checking usage",
          description: "We couldn't verify your usage status. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      if (!existingData) {
        console.log('[Credits] Creating new free tier usage record');
        const { data: newData, error: insertError } = await supabase
          .from("free_tier_usage")
          .insert([{ 
            user_id: user.id, 
            generations_used: 0 
          }])
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('[Credits] Error creating free tier usage record:', insertError);
          toast({
            title: "Error creating usage record",
            description: "We couldn't initialize your usage status. Please try again.",
            variant: "destructive",
          });
          return null;
        }

        console.log('[Credits] Created new free tier usage record:', newData);
        return newData;
      }

      console.log('[Credits] Found existing free tier usage record:', existingData);
      return existingData;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 30000, // Only refetch every 30 seconds
  });

  useEffect(() => {
    if (user && freeUsage && !subscription) {
      const freeUsed = freeUsage.generations_used || 0;
      if (freeUsed >= 12 && location.pathname.includes('/ad-wizard')) {
        toast({
          title: "Free credits exhausted",
          description: "Please upgrade to continue generating ads.",
          variant: "destructive",
        });
        navigate('/pricing');
      }
    } else if (subscription?.credits_remaining === 0 && location.pathname.includes('/ad-wizard')) {
      toast({
        title: "Credits exhausted",
        description: "Please purchase more credits to continue.",
        variant: "destructive",
      });
      navigate('/pricing');
    }
  }, [user, freeUsage, subscription, toast, navigate, location.pathname]);

  const getCreditsDisplay = () => {
    if (!user) return "";

    if (user.email === "info@fmbonline.nl") {
      return "Unlimited credits";
    }

    if (subscription?.credits_remaining !== undefined) {
      return `${subscription.credits_remaining} credits`;
    }
    
    const freeUsed = freeUsage?.generations_used || 0;
    const freeRemaining = 12 - freeUsed;
    return `${freeRemaining}/12 free generations`;
  };

  return (
    <div className="text-sm font-medium">
      {getCreditsDisplay()}
    </div>
  );
};
