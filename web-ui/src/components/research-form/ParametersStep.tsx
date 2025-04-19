'use client';

import { useState } from 'react';
import { FormData } from './ResearchForm';

// Import available models
import { AVAILABLE_MODELS } from '../../../../src/ai/providers';

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
}

export default function ParametersStep({ initialParameters, onSubmit }: ParametersStepProps) {
  const [parameters, setParameters] = useState(initialParameters);

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
            >
              <option value="">Default (Claude 3 Opus)</option>
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select a model to use for generating the report. More powerful models may produce better results but may take longer.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
