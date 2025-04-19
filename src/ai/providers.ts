import { createFireworks } from '@ai-sdk/fireworks';
import { createOpenAI } from '@ai-sdk/openai';
import {
  extractReasoningMiddleware,
  LanguageModelV1,
  wrapLanguageModel,
} from 'ai';
import { getEncoding } from 'js-tiktoken';

import { RecursiveCharacterTextSplitter } from './text-splitter';

// Providers
const openai = process.env.OPENAI_KEY
  ? createOpenAI({
      apiKey: process.env.OPENAI_KEY,
      baseURL: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1',
    })
  : undefined;

const fireworks = process.env.FIREWORKS_KEY
  ? createFireworks({
      apiKey: process.env.FIREWORKS_KEY,
    })
  : undefined;

// OpenRouter provider
const openrouter = process.env.OPENROUTER_KEY
  ? createOpenAI({
      apiKey: process.env.OPENROUTER_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })
  : undefined;

const customModel = process.env.CUSTOM_MODEL
  ? openai?.(process.env.CUSTOM_MODEL, {
      structuredOutputs: true,
    })
  : undefined;

// Models
const o3MiniModel = openai?.('o3-mini', {
  reasoningEffort: 'medium',
  structuredOutputs: true,
});

const deepSeekR1Model = fireworks
  ? wrapLanguageModel({
      model: fireworks(
        'accounts/fireworks/models/deepseek-r1',
      ) as LanguageModelV1,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  : undefined;

// Available OpenRouter models
export const AVAILABLE_MODELS = [
  { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'Google' },
  { id: 'anthropic/claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'Meta' },
  { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', provider: 'Meta' },
  { id: 'google/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'google/gemini-1.0-pro-latest', name: 'Gemini 1.0 Pro', provider: 'Google' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'openai/gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'mistralai/mistral-large-latest', name: 'Mistral Large', provider: 'Mistral AI' },
  { id: 'mistralai/mistral-medium-latest', name: 'Mistral Medium', provider: 'Mistral AI' },
  { id: 'mistralai/mistral-small-latest', name: 'Mistral Small', provider: 'Mistral AI' },
];

// Default model to use if none is specified
const DEFAULT_MODEL = 'google/gemma-3-27b-it';

// Create a model instance from OpenRouter
function createOpenRouterModel(modelId: string): LanguageModelV1 | undefined {
  if (!openrouter) return undefined;

  // For OpenAI models, we need to avoid using json_schema response_format
  // as it's not supported by all API versions
  if (modelId.startsWith('openai/')) {
    return openrouter(modelId, {
      reasoningEffort: 'high',
      // Don't use structuredOutputs for OpenAI models through OpenRouter
      // as it causes issues with json_schema response_format
    });
  }

  // For other models, use structuredOutputs
  return openrouter(modelId, {
    reasoningEffort: 'high',
    structuredOutputs: true,
  });
}

export function getModel(modelId?: string): LanguageModelV1 {
  console.log('getModel called with modelId:', modelId);

  // If a specific model ID is provided, try to use OpenRouter
  if (modelId && openrouter) {
    console.log('Using specified model:', modelId);
    const openRouterModel = createOpenRouterModel(modelId);
    if (openRouterModel) return openRouterModel;
  }

  // If OpenRouter is available but no specific model is requested, use the default
  if (openrouter && !modelId) {
    console.log('Using default model:', DEFAULT_MODEL);
    const defaultOpenRouterModel = createOpenRouterModel(DEFAULT_MODEL);
    if (defaultOpenRouterModel) return defaultOpenRouterModel;
  }

  // Fall back to custom model if specified
  if (customModel) {
    return customModel;
  }

  // Fall back to other available models
  const model = deepSeekR1Model ?? o3MiniModel;
  if (!model) {
    throw new Error('No model found');
  }

  return model as LanguageModelV1;
}

const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// trim prompt to maximum context size
export function trimPrompt(
  prompt: string,
  contextSize = Number(process.env.CONTEXT_SIZE) || 128_000,
) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}
