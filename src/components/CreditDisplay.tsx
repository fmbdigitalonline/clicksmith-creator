import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useCreditsManagement } from "@/hooks/useCreditsManagement";

export const CreditDisplay = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { credits, isLoadingCredits } = useCreditsManagement();

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
        return null;
      }

      console.log('[Credits] Found subscription:', data);
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: freeUsage } = useQuery({
    queryKey: ["free_tier_usage", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('[Credits] Checking free tier usage for user:', user.id);
      
      const { data, error } = await supabase
        .from("free_tier_usage")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error('[Credits] Error fetching free tier usage:', error);
        return null;
      }

      console.log('[Credits] Found free tier usage:', data);
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30000,
    refetchInterval: 30000,
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

    if (isLoadingCredits) {
      return "Loading...";
    }

    if (typeof credits === 'number') {
      if (credits === -1) {
        return "Unlimited credits";
      }
      if (subscription?.credits_remaining !== undefined) {
        return `${credits} credits`;
      }
      return `${credits}/12 free generations`;
    }

    return "";
  };

  return (
    <div className="text-sm font-medium">
      {getCreditsDisplay()}
    </div>
  );
};