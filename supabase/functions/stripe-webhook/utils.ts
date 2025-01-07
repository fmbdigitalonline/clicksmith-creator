// Base headers for CORS and content type
export const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'stripe-signature, content-type',
  'Content-Type': 'application/json',
};

// Create a standardized error response
export const createErrorResponse = (message: string, status: number) => {
  return new Response(
    JSON.stringify({ error: message }), 
    { 
      status, 
      headers: baseHeaders 
    }
  );
};

// Create a standardized success response
export const createSuccessResponse = (data: any) => {
  return new Response(
    JSON.stringify(data), 
    { 
      status: 200, 
      headers: baseHeaders 
    }
  );
};