import { corsHeaders } from "../../_shared/cors.ts";

export const handleOptionsRequest = () => {
  return new Response(null, { 
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
  });
};

export const createErrorResponse = (error: Error, status = 400) => {
  console.error('[generate-ad-content] Error in function:', error);
  return new Response(
    JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: status,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
};

export const createSuccessResponse = (data: any) => {
  return new Response(
    JSON.stringify(data), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
};