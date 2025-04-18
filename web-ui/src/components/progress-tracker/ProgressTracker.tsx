'use client';

import { useEffect, useState } from 'react';

export type ResearchProgress = {
  stage: 'initializing' | 'generating-queries' | 'searching-web' | 'searching-pubmed' | 'processing-results' | 'generating-report' | 'complete';
  percentage: number;
  currentQuery?: string;
  sources: string[];
};

interface ProgressTrackerProps {
  researchId: string;
  onComplete: () => void;
}

export default function ProgressTracker({ researchId, onComplete }: ProgressTrackerProps) {
  const [progress, setProgress] = useState<ResearchProgress>({
    stage: 'initializing',
    percentage: 0,
    sources: []
  });

  useEffect(() => {
    // Use Server-Sent Events for real-time progress updates
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051';
    const eventSource = new EventSource(`${apiUrl}/api/research/progress/${researchId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        // If the progress is complete, call the onComplete callback
        if (data.stage === 'complete' && data.percentage === 100) {
          setTimeout(() => {
            eventSource.close();
            onComplete();
          }, 1000); // Small delay to show the 100% state
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();

      // Fallback to polling if SSE fails
      const checkProgress = async () => {
        try {
          const response = await fetch(`${apiUrl}/api/research/${researchId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'completed') {
              onComplete();
              return;
            }
          }
          setTimeout(checkProgress, 2000);
        } catch (error) {
          console.error('Error checking progress:', error);
          setTimeout(checkProgress, 5000); // Longer delay on error
        }
      };

      checkProgress();
    };

    return () => {
      eventSource.close();
    };
  }, [researchId, onComplete]);

  const stageLabels = {
    'initializing': 'Setting up research',
    'generating-queries': 'Generating search queries',
    'searching-web': 'Searching the web',
    'searching-pubmed': 'Searching PubMed',
    'processing-results': 'Processing results',
    'generating-report': 'Generating final report',
    'complete': 'Research complete'
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Research in Progress</h2>

      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-base font-medium text-blue-700">
            {stageLabels[progress.stage]}
          </span>
          <span className="text-sm font-medium text-blue-700">
            {progress.percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>
      </div>

      {progress.currentQuery && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Current Query:</h3>
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-gray-700 italic">{progress.currentQuery}</p>
          </div>
        </div>
      )}

      {progress.sources.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Sources Found:</h3>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
            <ul className="divide-y divide-gray-200">
              {progress.sources.map((source, index) => (
                <li key={index} className="p-3 hover:bg-gray-50">
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
