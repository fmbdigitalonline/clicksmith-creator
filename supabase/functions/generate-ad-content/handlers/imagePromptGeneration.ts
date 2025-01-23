import { BusinessIdea, TargetAudience, MarketingCampaign } from '../Types.ts';
import { generateWithReplicate } from './utils/replicateUtils.ts';

const safeJSONParse = (str: string) => {
  try {
    // First clean any markdown formatting
    let cleaned = str.replace(/```json\s*/g, '')  // Remove ```json
                    .replace(/```\s*/g, '')       // Remove closing ```
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
                    .replace(/\n/g, ' ')
                    .trim();
    
    // If the string starts with a markdown block, extract just the JSON
    const jsonMatch = cleaned.match(/\[.*\]/s);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('JSON Parse Error:', error);
    console.log('Problematic string:', str);
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
};

const AD_FORMATS = [
  { width: 1200, height: 628, label: "Landscape (1.91:1)" },
  { width: 1080, height: 1080, label: "Square (1:1)" },
  { width: 1080, height: 1920, label: "Story (9:16)" }
];

export async function generateImagePrompts(
  businessIdea: BusinessIdea,
  targetAudience: TargetAudience,
  campaign?: MarketingCampaign
) {
  const audiencePainPoints = targetAudience.painPoints || [];
  const deepPainPoints = targetAudience.audienceAnalysis?.deepPainPoints || [];
  const allPainPoints = [...new Set([...audiencePainPoints, ...deepPainPoints])];

  const prompt = `Generate creative image prompt for marketing visual based on this business and target audience:

Business:
${JSON.stringify(businessIdea, null, 2)}

Target Audience:
${JSON.stringify({ ...targetAudience, painPoints: allPainPoints }, null, 2)}

${campaign ? `Campaign Details:
${JSON.stringify(campaign, null, 2)}` : ''}

Key Pain Points to Address:
${allPainPoints.map(point => `- ${point}`).join('\n')}

Create 1 image prompt that:
1. Must be STRICTLY photorealistic - NO cartoon, illustration, or artistic styles
2. Must look like it was shot with a professional DSLR camera
3. Must have professional studio lighting and composition
4. Must be suitable for commercial advertising
5. Must visually represent the value proposition
6. Must connect emotionally with the target audience
7. Must address their pain points visually
8. Must follow professional advertising best practices

IMPORTANT REQUIREMENTS:
- ONLY photorealistic commercial photography style
- NO artistic interpretations or stylization
- NO cartoon, illustration, or digital art styles
- Must look like a real photograph taken with professional equipment
- Clean, high-end commercial advertising aesthetic

Return ONLY a valid JSON array with exactly 1 item in this format:
[
  {
    "prompt": "detailed_image_prompt"
  }
]`;

  try {
    console.log('Generating image prompts with:', { 
      businessIdea, 
      targetAudience, 
      campaign,
      combinedPainPoints: allPainPoints 
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert commercial photographer and art director who creates detailed prompts for photorealistic marketing visuals. You ONLY create prompts for professional, commercial photography style images - never cartoons, illustrations, or artistic interpretations.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', data);

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI');
    }

    const generatedPrompts = safeJSONParse(data.choices[0].message.content);
    console.log('Generated prompts:', generatedPrompts);

    if (!Array.isArray(generatedPrompts) || generatedPrompts.length === 0) {
      throw new Error('Invalid prompts format: Expected non-empty array');
    }

    // Generate images for each format
    const imagePromises = AD_FORMATS.map(async (format) => {
      if (!generatedPrompts[0].prompt || typeof generatedPrompts[0].prompt !== 'string') {
        throw new Error('Invalid prompt format: Expected string prompt');
      }

      const imageUrl = await generateWithReplicate(generatedPrompts[0].prompt, {
        width: format.width,
        height: format.height
      });

      return {
        url: imageUrl,
        prompt: generatedPrompts[0].prompt,
        width: format.width,
        height: format.height,
        label: format.label
      };
    });

    const images = await Promise.all(imagePromises);
    console.log('Successfully generated images:', images);
    
    return { images };
  } catch (error) {
    console.error('Error in image prompt generation:', error);
    throw error;
  }
}
