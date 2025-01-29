import { BusinessIdea, TargetAudience } from "../types.ts";

export async function generateCampaign(businessIdea: any, targetAudience: any, platform: string = 'facebook') {
  const platformSpecificPrompt = getPlatformSpecificPrompt(platform);
  
  const prompt = `Create a marketing campaign for this business and target audience, specifically optimized for ${platform}:

Business:
${JSON.stringify(businessIdea, null, 2)}

Target Audience:
${JSON.stringify(targetAudience, null, 2)}

${platformSpecificPrompt}

Create a complete marketing campaign with:
1. 3 Marketing angles with hooks
2. 3 Ad copies (different versions)
3. EXACTLY 10 unique Headlines (6 words max)

Marketing Angles Guidelines:
- Create 3 different marketing angles
- Each angle should have a description and a hook
- Focus on different aspects of the value proposition
- Address different pain points
- Optimize for ${platform}'s specific audience expectations

Ad Copy Guidelines:
- Create 3 different versions:
  1. "story": Longer, storytelling-based version
  2. "short": Short, impactful version
  3. "aida": AIDA framework version
- Each version should be different
- Must attract attention in first sentence
- Talk directly to the reader using "you"
- Follow ${platform}'s best practices for ad copy

Headline Guidelines:
- MUST generate EXACTLY 10 unique headlines
- Maximum 6 words each
- Each headline must be completely different
- Straight to the point
- Highlight benefits or results
- Optimize for ${platform}'s format and audience

Return ONLY a valid JSON object with these fields:
{
  "angles": [
    {
      "description": "string",
      "hook": "string"
    }
  ],
  "adCopies": [
    {
      "type": "story|short|aida",
      "content": "string"
    }
  ],
  "headlines": ["string"]
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
            content: `You are an expert ${platform} marketing copywriter. Always respond with raw JSON only, no markdown. Always generate EXACTLY 10 unique headlines.`
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
    
    // Validate response format
    if (!campaign.angles || !Array.isArray(campaign.angles) || campaign.angles.length === 0) {
      throw new Error('Invalid angles in response');
    }
    if (!campaign.adCopies || !Array.isArray(campaign.adCopies) || campaign.adCopies.length === 0) {
      throw new Error('Invalid ad copies in response');
    }
    if (!campaign.headlines || !Array.isArray(campaign.headlines) || campaign.headlines.length !== 10) {
      throw new Error('Invalid headlines in response - must have exactly 10 headlines');
    }
    
    console.log('[generateCampaign] Parsed and validated campaign:', campaign);

    return { campaign };
  } catch (error) {
    console.error('[generateCampaign] Error in generateCampaign:', error);
    throw error;
  }
}

function getPlatformSpecificPrompt(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'facebook':
      return `Optimize for Facebook Ads:
- Use conversational, engaging tone
- Focus on emotional triggers
- Include clear call-to-actions
- Keep text concise for mobile viewing`;
    
    case 'google':
      return `Optimize for Google Display Ads:
- Focus on keywords and search intent
- Be direct and benefit-focused
- Include clear value propositions
- Use action-oriented language`;
    
    case 'linkedin':
      return `Optimize for LinkedIn Ads:
- Use professional, business-focused language
- Focus on B2B benefits and ROI
- Include industry-specific terminology
- Highlight professional growth and business value`;
    
    case 'tiktok':
      return `Optimize for TikTok Ads:
- Use casual, trendy language
- Focus on entertainment and engagement
- Include trending phrases and hooks
- Keep content dynamic and youth-focused`;
    
    default:
      return '';
  }
}