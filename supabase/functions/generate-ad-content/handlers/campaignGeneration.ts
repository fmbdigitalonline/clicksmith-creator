import { BusinessIdea, TargetAudience } from "../types.ts";

export async function generateCampaign(businessIdea: any, targetAudience: any, platform: string = 'facebook') {
  const platformSpecificPrompt = getPlatformSpecificPrompt(platform);
  
  // Create a focused audience context for the prompt
  const audienceContext = `
Target Audience Details:
- Persona: ${targetAudience.name}
- Pain Points: ${targetAudience.painPoints.join(', ')}
- Ideal Customer Profile: ${targetAudience.icp}
- Core Message: ${targetAudience.coreMessage}
- Positioning: ${targetAudience.positioning}
- Marketing Angle: ${targetAudience.marketingAngle}
- Messaging Approach: ${targetAudience.messagingApproach}`;
  
  const prompt = `Create a marketing campaign for this business and target audience, specifically optimized for ${platform}:

Business:
${JSON.stringify(businessIdea, null, 2)}

${audienceContext}

${platformSpecificPrompt}

Create a complete marketing campaign with:
1. 3 Marketing angles with hooks
2. EXACTLY 10 unique Ad copies (completely different versions, each addressing different pain points and aspects of the target audience)
3. EXACTLY 10 unique Headlines (6 words max)

Marketing Angles Guidelines:
- Create 3 different marketing angles
- Each angle should have a description and a hook
- Focus on different aspects of the value proposition
- Address different pain points from the target audience
- Optimize for ${platform}'s specific audience expectations

Ad Copy Guidelines:
- Create EXACTLY 10 unique ad copies
- Each copy MUST be completely different in content and approach
- Each version should address a different pain point or desire from the target audience
- Must attract attention in first sentence
- Talk directly to the reader using "you"
- Follow ${platform}'s best practices for ad copy
- Ensure each copy has a unique selling point or hook
- Use the specified messaging approach and positioning
- Incorporate the core message in different ways

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
    console.log('[generateCampaign] Starting campaign generation with audience context...');
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
            content: `You are an expert ${platform} marketing copywriter specializing in persona-based marketing. 
            Always generate EXACTLY 10 unique ad copies and headlines with no duplicates. 
            Each ad copy must address different aspects of the target audience's needs and pain points.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
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
    
    // Validate response format and uniqueness
    if (!campaign.angles || !Array.isArray(campaign.angles) || campaign.angles.length === 0) {
      throw new Error('Invalid angles in response');
    }
    if (!campaign.adCopies || !Array.isArray(campaign.adCopies) || campaign.adCopies.length !== 10) {
      throw new Error('Invalid ad copies in response - must have exactly 10 unique copies');
    }
    if (!campaign.headlines || !Array.isArray(campaign.headlines) || campaign.headlines.length !== 10) {
      throw new Error('Invalid headlines in response - must have exactly 10 headlines');
    }

    // Validate uniqueness of ad copies and ensure they use audience information
    const uniqueAdCopies = new Set(campaign.adCopies.map(copy => copy.content));
    if (uniqueAdCopies.size !== campaign.adCopies.length) {
      throw new Error('Duplicate ad copies detected - all copies must be unique');
    }
    
    // Additional validation to ensure audience context is used
    const requiredTerms = [
      targetAudience.coreMessage.toLowerCase(),
      ...targetAudience.painPoints.map(point => point.toLowerCase())
    ];
    
    const adCopiesText = campaign.adCopies.map(copy => copy.content.toLowerCase()).join(' ');
    const missingTerms = requiredTerms.filter(term => !adCopiesText.includes(term));
    
    if (missingTerms.length > 0) {
      console.warn('[generateCampaign] Warning: Some audience context terms are not used:', missingTerms);
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