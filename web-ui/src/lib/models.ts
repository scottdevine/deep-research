// Model interface
export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
  capabilities?: Record<string, any>;
}

// Function to fetch models from the API
export async function fetchModels(): Promise<Model[]> {
  try {
    const response = await fetch('/api/models');

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

// Default models to use as fallback if API fails
export const DEFAULT_MODELS: Model[] = [
  { id: 'anthropic/claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'Meta' },
];
