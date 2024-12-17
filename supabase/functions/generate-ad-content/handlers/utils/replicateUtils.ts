import { corsHeaders } from '../../../_shared/cors.ts';

export async function generateWithReplicate(
  replicate: any,
  prompt: string,
  dimensions: { width: number; height: number }
): Promise<string> {
  console.log('Starting image generation with Replicate:', { prompt, dimensions });

  try {
    // Using a stable and public model version from Stability AI
    const prediction = await replicate.predictions.create({
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt: prompt,
        negative_prompt: "text, words, letters, numbers, symbols, watermarks, logos, labels, signs, writing, typography, fonts, characters, alphabets, digits, punctuation marks, nsfw, nudity, violence, gore, weapons, drugs, inappropriate content, offensive content, controversial content, suggestive content, unsafe content, adult content, explicit content",
        width: dimensions.width,
        height: dimensions.height,
        num_outputs: 1,
        scheduler: "DPMSolver++",
        num_inference_steps: 50,
        guidance_scale: 7.5,
        prompt_strength: 0.8,
      }
    });

    console.log('Prediction created:', prediction);

    const maxWaitTime = 60000;
    const startTime = Date.now();
    let result;
    let lastStatus = '';

    while (!result && Date.now() - startTime < maxWaitTime) {
      result = await replicate.predictions.get(prediction.id);
      
      if (result.status !== lastStatus) {
        console.log(`Generation status updated to: ${result.status}`);
        lastStatus = result.status;
      }
      
      if (result.status === "succeeded") {
        break;
      } else if (result.status === "failed") {
        throw new Error(`Prediction failed: ${result.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!result || result.status !== "succeeded") {
      throw new Error('Image generation timed out or failed');
    }

    console.log('Generation result:', result);

    if (!result.output) {
      throw new Error('No output received from image generation');
    }

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    
    if (!imageUrl) {
      throw new Error('No valid image URL in output');
    }

    return imageUrl;
  } catch (error) {
    console.error('Error in generateWithReplicate:', error);
    throw error;
  }
}