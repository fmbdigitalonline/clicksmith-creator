export async function generateHooks(businessIdea: any, targetAudience: any) {
  const prompt = `Create marketing hooks for this business and target audience:

Business:
${JSON.stringify(businessIdea, null, 2)}

Target Audience:
${JSON.stringify(targetAudience, null, 2)}

Create EXACTLY 10 unique and different marketing hooks that:
1. Must be completely different from each other - no similar themes or approaches
2. Must address specific pain points
3. Must be very short and impactful
4. Must make the audience stop and read
5. Must call out the target audience either obviously or through shared knowledge
6. Can be questions, statements, or commands
7. Can use humor or emotion when appropriate
8. Must make it obvious the ad is for them
9. Must each focus on a different aspect or benefit
10. Must each have a unique angle or perspective

IMPORTANT: Generate EXACTLY 10 completely different hooks, each with its own unique approach and focus.

Return ONLY a valid JSON array with exactly 10 items in this format:
[
  {
    "text": "The actual hook text that will be shown in the ad",
    "description": "The marketing angle explanation"
  }
]`;

  try {
    console.log('Generating hooks with prompt:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert marketing strategist that creates compelling and diverse marketing angles and hooks based on deep audience analysis. You must create exactly 10 completely different hooks, each with its own unique approach and focus. Never repeat similar themes or approaches.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 1.0,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', data);

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    try {
      const content = data.choices[0].message.content.trim();
      console.log('Raw content:', content);
      
      const jsonContent = content.replace(/```json\n|\n```|```/g, '').trim();
      console.log('Cleaned content:', jsonContent);
      
      const hooks = JSON.parse(jsonContent);
      
      if (!Array.isArray(hooks) || hooks.length !== 10) {
        throw new Error('Response must be an array with exactly 10 items');
      }

      hooks.forEach((hook, index) => {
        if (!hook.text || !hook.description) {
          throw new Error(`Hook at index ${index} is missing required fields`);
        }
      });

      console.log('Successfully parsed hooks:', hooks);
      return { hooks };
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw new Error('Failed to parse hook data: ' + parseError.message);
    }
  } catch (error) {
    console.error('Error in hook generation:', error);
    throw error;
  }
}