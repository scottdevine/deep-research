'use client';

import { useState } from 'react';
import { FormData } from './ResearchForm';

interface ParametersStepProps {
  initialParameters: {
    breadth: number;
    depth: number;
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
