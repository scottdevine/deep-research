import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051';
    const response = await fetch(`${apiUrl}/api/models`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching models:', error);

    // Return fallback models
    return NextResponse.json(
      [
        { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'Google', context_length: 32768 },
        { id: 'anthropic/claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic', context_length: 200000 },
        { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context_length: 128000 },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', context_length: 128000 },
        { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'Meta', context_length: 8192 },
      ],
      { status: 200 }
    );
  }
}
