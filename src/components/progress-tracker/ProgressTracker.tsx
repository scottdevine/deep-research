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
    // In a real implementation, we would use Server-Sent Events or WebSockets
    // For now, we'll simulate progress updates
    
    const stages: ResearchProgress['stage'][] = [
      'initializing',
      'generating-queries',
      'searching-web',
      'searching-pubmed',
      'processing-results',
      'generating-report',
      'complete'
    ];
    
    let currentStageIndex = 0;
    let currentPercentage = 0;
    const sources: string[] = [];
    
    const interval = setInterval(() => {
      // Increment percentage within current stage
      currentPercentage += 5;
      
      // Add a sample source every 15%
      if (currentPercentage % 15 === 0 && 
          (stages[currentStageIndex] === 'searching-web' || 
           stages[currentStageIndex] === 'searching-pubmed')) {
        sources.push(`https://example.com/source-${sources.length + 1}`);
      }
      
      // Move to next stage when reaching 100%
      if (currentPercentage >= 100) {
        currentStageIndex++;
        currentPercentage = 0;
        
        // If we've completed all stages, stop the interval
        if (currentStageIndex >= stages.length) {
          clearInterval(interval);
          onComplete();
          return;
        }
      }
      
      // Update progress state
      setProgress({
        stage: stages[currentStageIndex],
        percentage: currentPercentage,
        currentQuery: stages[currentStageIndex] === 'searching-web' || stages[currentStageIndex] === 'searching-pubmed' 
          ? `Sample query ${currentStageIndex + 1}` 
          : undefined,
        sources: [...sources]
      });
    }, 500);
    
    return () => clearInterval(interval);
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
