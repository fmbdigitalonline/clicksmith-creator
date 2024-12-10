export async function handleImagePromptGeneration(businessIdea: any, targetAudience: any, campaign: any, openAIApiKey: string) {
  const prompt = `Generate exactly 6 different image prompts for Facebook ads based on the following information:

Business:
${JSON.stringify(businessIdea, null, 2)}

Target Audience:
${JSON.stringify(targetAudience, null, 2)}

Campaign:
${JSON.stringify(campaign, null, 2)}

Create exactly 6 prompts, with this distribution:
1. Two positive scenes showing the solution in action
2. Two problem-related scenes the audience can relate to
3. Two lifestyle/aspirational scenes that resonate with the target audience

Style Instructions for ALL images:
- Ultra-realistic, professional photography style
- Clean composition with space for text overlay
- Vibrant, engaging colors
- Maximum 2 people per image
- Emotional impact
- High-end commercial look
- Perfect for Facebook ads`;

  console.log('Generating prompts with OpenAI...');
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
          content: 'You are an expert at creating detailed prompts for AI image generation that align with marketing campaigns. Always return exactly 6 numbered prompts.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }

  // Extract exactly 6 prompts from the response
  const prompts = data.choices[0].message.content
    .split('\n')
    .filter(line => line.trim().match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, ''))
    .slice(0, 6);

  console.log('Generated prompts:', prompts);
  
  if (prompts.length !== 6) {
    throw new Error('Failed to generate exactly 6 prompts');
  }

  // Generate exactly 6 images using DALL-E 2
  console.log('Generating images with DALL-E 2...');
  const images = await Promise.all(
    prompts.map(async (prompt) => {
      console.log('Generating image for prompt:', prompt);
      
      const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "dall-e-2",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          response_format: "url"
        }),
      });

      const imageData = await imageResponse.json();
      if (imageData.error) {
        console.error('Error generating image:', imageData.error);
        throw new Error(imageData.error.message);
      }

      return {
        url: imageData.data[0].url,
        prompt: prompt,
      };
    })
  );

  console.log(`Successfully generated ${images.length} images`);
  return { images };
}