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
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        toast({
          title: "Error checking subscription",
          description: "We couldn't verify your subscription status. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: freeUsage } = useQuery({
    queryKey: ["free_tier_usage", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("free_tier_usage")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        toast({
          title: "Error checking usage",
          description: "We couldn't verify your usage status. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      return data || { generations_used: 0 };
    },
    enabled: !!user?.id,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
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