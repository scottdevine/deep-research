'use client';

import { useState, useEffect } from 'react';
import { FormData } from './ResearchForm';

// Import models types and functions
import { Model, fetchModels, DEFAULT_MODELS } from '../../lib/models';

interface ParametersStepProps {
  initialParameters: {
    breadth: number;
    depth: number;
    insightDetail: number; // Add the insightDetail parameter
    modelId?: string; // Add the model parameter
    outputType: 'report' | 'answer';
    meshRestrictiveness: 'low' | 'medium' | 'high';
  };
  onSubmit: (parameters: Partial<FormData>) => void;
  isLoading?: boolean; // Add loading state prop
}

export default function ParametersStep({ initialParameters, onSubmit, isLoading = false }: ParametersStepProps) {
  const [parameters, setParameters] = useState(initialParameters);
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  // Fetch models when component mounts
  useEffect(() => {
    async function loadModels() {
      try {
        setIsLoadingModels(true);
        setModelError(null);
        const fetchedModels = await fetchModels();

        if (fetchedModels.length > 0) {
          setModels(fetchedModels);
        } else {
          // If no models were returned, use defaults and show a warning
          setModelError('Could not load models from OpenRouter. Using default models.');
        }
      } catch (error) {
        console.error('Error loading models:', error);
        setModelError('Failed to load models. Using default models.');
      } finally {
        setIsLoadingModels(false);
      }
    }

    loadModels();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(parameters);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Research Parameters</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure how broad and deep your research should be.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="breadth" className="block text-sm font-medium text-gray-700">
            Research Breadth (how wide the search should be)
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <input
              id="breadth"
              type="range"
              min="1"
              max="10"
              value={parameters.breadth}
              onChange={(e) => setParameters({ ...parameters, breadth: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-900 w-8 text-center">
              {parameters.breadth}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Recommended: 2-10, Default: 4. Higher values will explore more topics but take longer.
          </p>
        </div>

        <div>
          <label htmlFor="depth" className="block text-sm font-medium text-gray-700">
            Research Depth (how deep the search should go)
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <input
              id="depth"
              type="range"
              min="1"
              max="5"
              value={parameters.depth}
              onChange={(e) => setParameters({ ...parameters, depth: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-900 w-8 text-center">
              {parameters.depth}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Recommended: 1-5, Default: 2. Higher values will explore topics in more detail but take longer.
          </p>
        </div>

        <div>
          <label htmlFor="insightDetail" className="block text-sm font-medium text-gray-700">
            Insight Detail (how comprehensive the learnings should be)
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <input
              id="insightDetail"
              type="range"
              min="1"
              max="10"
              value={parameters.insightDetail}
              onChange={(e) => setParameters({ ...parameters, insightDetail: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-900 w-8 text-center">
              {parameters.insightDetail}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Recommended: 1-10, Default: 5. Higher values will produce more detailed and comprehensive insights and reports.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Output Type</label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center">
              <input
                id="report"
                name="outputType"
                type="radio"
                checked={parameters.outputType === 'report'}
                onChange={() => setParameters({ ...parameters, outputType: 'report' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="report" className="ml-3 block text-sm font-medium text-gray-700">
                Detailed Report
                <span className="text-xs text-gray-500 block">
                  A comprehensive analysis with sections, citations, and detailed findings
                </span>
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="answer"
                name="outputType"
                type="radio"
                checked={parameters.outputType === 'answer'}
                onChange={() => setParameters({ ...parameters, outputType: 'answer' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="answer" className="ml-3 block text-sm font-medium text-gray-700">
                Concise Answer
                <span className="text-xs text-gray-500 block">
                  A brief, direct response to your query
                </span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            PubMed MeSH Term Restrictiveness
          </label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center">
              <input
                id="low"
                name="meshRestrictiveness"
                type="radio"
                checked={parameters.meshRestrictiveness === 'low'}
                onChange={() => setParameters({ ...parameters, meshRestrictiveness: 'low' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="low" className="ml-3 block text-sm font-medium text-gray-700">
                Low
                <span className="text-xs text-gray-500 block">
                  Broader search with more results
                </span>
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="medium"
                name="meshRestrictiveness"
                type="radio"
                checked={parameters.meshRestrictiveness === 'medium'}
                onChange={() => setParameters({ ...parameters, meshRestrictiveness: 'medium' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="medium" className="ml-3 block text-sm font-medium text-gray-700">
                Medium
                <span className="text-xs text-gray-500 block">
                  Balanced approach
                </span>
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="high"
                name="meshRestrictiveness"
                type="radio"
                checked={parameters.meshRestrictiveness === 'high'}
                onChange={() => setParameters({ ...parameters, meshRestrictiveness: 'high' })}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="high" className="ml-3 block text-sm font-medium text-gray-700">
                High
                <span className="text-xs text-gray-500 block">
                  Narrower search with more specific results
                </span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="modelId" className="block text-sm font-medium text-gray-700">
            AI Model
          </label>
          <div className="mt-1">
            <select
              id="modelId"
              value={parameters.modelId || ''}
              onChange={(e) => setParameters({ ...parameters, modelId: e.target.value })}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              disabled={isLoadingModels}
            >
              <option value="">Default (Gemma 3 27B)</option>
              {isLoadingModels ? (
                <option disabled>Loading models...</option>
              ) : (
                // Group models by provider and filter out free models (they often have limitations)
                Object.entries(
                  models
                    .filter(model => !model.id.includes(':free')) // Filter out free models
                    .reduce((acc, model) => {
                      const provider = model.provider || 'Other';
                      if (!acc[provider]) acc[provider] = [];
                      acc[provider].push(model);
                      return acc;
                    }, {} as Record<string, Model[]>)
                )
                .sort(([a], [b]) => a.localeCompare(b)) // Sort providers alphabetically
                .map(([provider, providerModels]) => (
                  <optgroup key={provider} label={provider}>
                    {providerModels
                      .sort((a, b) => {
                        // Sort by context length (descending) then by name
                        if (a.context_length !== b.context_length) {
                          return (b.context_length || 0) - (a.context_length || 0);
                        }
                        return a.name.localeCompare(b.name);
                      })
                      .map((model) => {
                        // Format the display name
                        const contextSize = model.context_length ? `(${Math.round(model.context_length / 1000)}k)` : '';
                        return (
                          <option key={model.id} value={model.id} title={model.description || ''}>
                            {model.name} {contextSize}
                          </option>
                        );
                      })}
                  </optgroup>
                ))
              )}
            </select>
            {modelError && (
              <p className="mt-1 text-xs text-red-500">{modelError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Select a model to use for generating the report. More powerful models may produce better results but may take longer.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className={`inline-flex justify-center rounded-md border border-transparent ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Questions...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
