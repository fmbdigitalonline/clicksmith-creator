import { toast } from "@/hooks/use-toast";

export const handleError = (error: Error, context: string) => {
  console.error(`[${context}] Error:`, error);
  
  // Log to monitoring service in production
  if (process.env.NODE_ENV === 'production') {
    // Here we would integrate with error monitoring services
    console.error('[Production Error]', {
      context,
      error: error.message,
      stack: error.stack,
    });
  }

  toast({
    title: "An error occurred",
    description: "Please try again. If the problem persists, contact support.",
    variant: "destructive",
  });
};

export const handleApiError = async (error: any, context: string) => {
  console.error(`[${context}] API Error:`, error);

  if (error.status === 401) {
    toast({
      title: "Session Expired",
      description: "Please log in again to continue.",
      variant: "destructive",
    });
    return;
  }

  if (error.status === 403) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to perform this action.",
      variant: "destructive",
    });
    return;
  }

  toast({
    title: "Service Error",
    description: "Unable to complete your request. Please try again.",
    variant: "destructive",
  });
};