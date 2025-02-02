import { BusinessIdea, TargetAudience } from "../types.ts";

export async function generateCampaign(businessIdea: any, targetAudience: any, platform: string = 'facebook') {
  // Validate required inputs
  if (!businessIdea || !targetAudience) {
    throw new Error('Business idea and target audience are required');
  }

  if (!targetAudience.demographics || !targetAudience.painPoints || !targetAudience.coreMessage) {
    throw new Error('Invalid target audience data: missing required fields');
  }

  const audienceContext = `
Target Audience Profile:
- Demographics: ${targetAudience.demographics}
- Pain Points: ${targetAudience.painPoints.join(', ')}
- Core Message: ${targetAudience.coreMessage}
- Ideal Customer Profile: ${targetAudience.icp}
- Marketing Angle: ${targetAudience.marketingAngle}
- Messaging Approach: ${targetAudience.messagingApproach}
- Positioning: ${targetAudience.positioning}
`;

  const platformSpecificPrompt = getPlatformSpecificPrompt(platform);
  
  const prompt = `Create a marketing campaign specifically tailored for this target audience and business, optimized for ${platform}:

Business:
${JSON.stringify(businessIdea, null, 2)}

${audienceContext}

${platformSpecificPrompt}

Create a complete marketing campaign with:
1. 3 Marketing angles with hooks that directly address the audience pain points
2. EXACTLY 10 unique Ad copies that:
   - Speak directly to the defined target audience profile
   - Address specific pain points mentioned
   - Use the core message as foundation
   - Follow the specified messaging approach
   - Maintain the defined positioning
   - Use the marketing angle effectively
3. EXACTLY 10 unique Headlines (6 words max) that resonate with the ICP

Marketing Angles Guidelines:
- Create 3 different marketing angles based on the audience profile
- Each angle should address specific pain points
- Focus on different aspects of the value proposition
- Use the defined messaging approach
- Optimize for ${platform}'s specific audience expectations

Ad Copy Guidelines:
- Create EXACTLY 10 unique ad copies
- Each copy MUST be completely different in approach
- Incorporate the core message naturally
- Address specific pain points from the audience profile
- Use the defined messaging tone and style
- Follow ${platform}'s best practices
- Ensure each copy has a unique selling point

Headline Guidelines:
- MUST generate EXACTLY 10 unique headlines
- Maximum 6 words each
- Each headline must be completely different
- Use language that resonates with the ICP
- Address key pain points or desires
- Optimize for ${platform}'s format

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
            content: `You are an expert ${platform} marketing copywriter specializing in persona-based content creation. Always respond with raw JSON only, no markdown. Always generate EXACTLY 10 unique ad copies and headlines with no duplicates.`
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

    // Validate uniqueness of ad copies
    const uniqueAdCopies = new Set(campaign.adCopies.map(copy => copy.content));
    if (uniqueAdCopies.size !== campaign.adCopies.length) {
      throw new Error('Duplicate ad copies detected - all copies must be unique');
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