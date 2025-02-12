import { BusinessIdea, TargetAudience } from "../types.ts";

export async function generateCampaign(businessIdea: any, targetAudience: any) {
  const prompt = `Create a marketing campaign for this business and target audience:

Business:
${JSON.stringify(businessIdea, null, 2)}

Target Audience:
${JSON.stringify(targetAudience, null, 2)}

Create a complete marketing campaign with:
1. 3 Ad copies (different versions)
2. EXACTLY 10 unique Headlines (6 words max)

Ad Copy Guidelines:
- Create 10 different versions and rotate:
  1. "Longer story": Longer, storytelling-based use pain point one from audience analysis
  2. "personal emotional story": personal emotional story use pain point two from audience analysis
  3. "AIDA version": Middle-length with bullet points use pain point three from audience analysis
- Should be addressing about audience analysis painpoints
- Some ad copies must also address the benefits of the products based on the positive experience the product provides
- Must attract attention in first sentence
- Each version should be different
- Never use names and always talk directly to the reader, use words like you

Headline Guidelines:
- MUST generate EXACTLY 10 unique headlines
- Maximum 6 words each
- Each headline must be completely different
- Straight to the point
- Highlight the result of using this product, the benefitial experience, or goal that is going te be achieved when using this product
- Based on market awareness/sophistication

Return ONLY a valid JSON object with these fields:
{
  "adCopies": [
    {
      "type": "story|short|aida",
      "content": "string"
    }
  ],
  "headlines": ["string", "string", "string", "string", "string", "string", "string", "string", "string", "string"]
}`;

  try {
    console.log('[generateCampaign] Sending request to OpenAI...');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert marketing copywriter. Always respond with raw JSON only, no markdown. Always generate EXACTLY 10 unique headlines.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[generateCampaign] OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    console.log('[generateCampaign] Raw OpenAI response:', data);

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI');
    }

    const content = data.choices[0].message.content;
    console.log('[generateCampaign] Content before parsing:', content);

    const campaign = JSON.parse(content);
    
    // Validate that we have exactly 10 unique headlines
    if (!campaign.headlines || campaign.headlines.length !== 10 || 
        new Set(campaign.headlines).size !== 10) {
      console.error('[generateCampaign] Did not receive 10 unique headlines:', campaign.headlines);
      throw new Error('Failed to generate 10 unique headlines');
    }
    
    console.log('[generateCampaign] Parsed campaign:', campaign);

    return { campaign };
  } catch (error) {
    console.error('[generateCampaign] Error in generateCampaign:', error);
    throw error;
  }
}