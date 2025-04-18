'use client';

import { useState } from 'react';

interface QueryStepProps {
  initialQuery: string;
  onSubmit: (query: string) => void;
}

export default function QueryStep({ initialQuery, onSubmit }: QueryStepProps) {
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a research query');
      return;
    }
    
    onSubmit(query);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">What would you like to research?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter a specific topic or question you want to explore in depth.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700">
            Research Query
          </label>
          <textarea
            id="query"
            name="query"
            rows={4}
            className={`mt-1 block w-full rounded-md border ${
              error ? 'border-red-300' : 'border-gray-300'
            } shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2`}
            placeholder="e.g., Latest treatments for rheumatoid arthritis"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setError('');
            }}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
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
      
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-500">Example queries:</h3>
        <ul className="mt-2 text-sm text-gray-500 list-disc pl-5 space-y-1">
          <li>Recent advances in cancer immunotherapy</li>
          <li>Impact of artificial intelligence on job markets</li>
          <li>Sustainable urban planning strategies for climate change</li>
        </ul>
      </div>
    </div>
  );
}
