import Replicate from "https://esm.sh/replicate@0.25.1";

interface ImageOptions {
  width: number;
  height: number;
  model?: string;
  numOutputs?: number;
  maxAttempts?: number;
  retryDelay?: number;
  maxRetries?: number;
}

interface RetryConfig {
  maxRetries: number;
  delay: number;
  backoffFactor: number;
}

const MODELS = {
  sdxl: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  sdxlBase: "8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f",
  sdv15: "a4a8bafd6089e5dad6dd6dc5b3304a8ff88a27615fa0b67d135b0dfd814187be",
  flux: "black-forest-labs/flux-1.1-pro"
} as const;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < config.maxRetries - 1) {
        const backoffTime = config.delay * Math.pow(config.backoffFactor, attempt);
        await delay(backoffTime);
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

function getScaledDimensions(width: number, height: number): { width: number; height: number } {
  const MAX_HEIGHT = 1440;
  const MAX_WIDTH = 1440;
  
  if (height <= MAX_HEIGHT && width <= MAX_WIDTH) {
    return { width, height };
  }

  const aspectRatio = width / height;
  
  if (height > MAX_HEIGHT) {
    const newHeight = MAX_HEIGHT;
    const newWidth = Math.round(newHeight * aspectRatio);
    return { width: newWidth, height: newHeight };
  }
  
  if (width > MAX_WIDTH) {
    const newWidth = MAX_WIDTH;
    const newHeight = Math.round(newWidth / aspectRatio);
    return { width: newWidth, height: newHeight };
  }

  return { width, height };
}

export async function generateWithReplicate(
  prompt: string,
  options: ImageOptions = { width: 1024, height: 1024 }
): Promise<string> {
  const defaultOptions = {
    model: 'flux',
    numOutputs: 1,
    maxAttempts: 30,
    maxRetries: 3,
    retryDelay: 1000,
  };

  const config = { ...defaultOptions, ...options };
  
  try {
    console.log('Starting image generation with configuration:', {
      prompt,
      model: config.model,
      options: config
    });

    const replicate = new Replicate({
      auth: Deno.env.get('REPLICATE_API_TOKEN'),
    });

    const scaledDimensions = getScaledDimensions(config.width, config.height);
    console.log('Using scaled dimensions:', scaledDimensions);

    const prediction = await retryWithBackoff(
      async () => {
        const modelId = MODELS[config.model as keyof typeof MODELS];
        console.log(`Using model: ${modelId}`);
        
        // Add business/professional context to the prompt
        const enhancedPrompt = `Professional business marketing content, commercial advertisement: ${prompt}`;
        console.log('Enhanced prompt:', enhancedPrompt);

        const result = await replicate.run(modelId, {
          input: {
            prompt: enhancedPrompt,
            width: scaledDimensions.width,
            height: scaledDimensions.height,
            num_outputs: config.numOutputs,
            prompt_upsampling: true,
            negative_prompt: "nsfw, inappropriate content, offensive content, controversial content, adult content, violence, gore, text, watermarks, nudity, suggestive content, drugs, weapons, disturbing imagery",
            safety_checker: true,
            num_inference_steps: 50,
            guidance_scale: 8.5,
            seed: Math.floor(Math.random() * 1000000),
            scheduler: "K_EULER",
            clip_skip: 2,
            safety_filter: true,
            remove_watermark: true,
            style_preset: "professional"
          }
        });

        console.log('Raw Replicate response:', result);
        return result;
      },
      {
        maxRetries: config.maxRetries,
        delay: config.retryDelay,
        backoffFactor: 2
      }
    );

    console.log('Prediction result:', prediction);

    let imageUrl: string;
    if (Array.isArray(prediction)) {
      imageUrl = prediction[0];
    } else if (typeof prediction === 'string') {
      imageUrl = prediction;
    } else if (prediction.output && Array.isArray(prediction.output)) {
      imageUrl = prediction.output[0];
    } else {
      throw new Error(`Unexpected response format from Replicate: ${JSON.stringify(prediction)}`);
    }
    
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      throw new Error(`Invalid URL format received: ${imageUrl}`);
    }

    console.log('Successfully generated image URL:', imageUrl);
    return imageUrl;

  } catch (error) {
    console.error('Error in generateWithReplicate:', {
      message: error.message,
      stack: error.stack,
      prompt,
      options: config
    });
    
    // Provide a more user-friendly error message
    if (error.message.includes('NSFW')) {
      throw new Error('The generated image was flagged as inappropriate. Trying to generate a more business-appropriate image...');
    }
    throw error;
  }
}