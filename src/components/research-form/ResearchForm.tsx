'use client';

import { useState } from 'react';
import QueryStep from './QueryStep';
import ParametersStep from './ParametersStep';
import FollowUpStep from './FollowUpStep';

export type FormData = {
  query: string;
  breadth: number;
  depth: number;
  outputType: 'report' | 'answer';
  meshRestrictiveness: 'low' | 'medium' | 'high';
  followUpAnswers: string[];
};

export type FollowUpQuestion = {
  id: string;
  question: string;
};

interface ResearchFormProps {
  onSubmit: (formData: FormData) => void;
}

export default function ResearchForm({ onSubmit }: ResearchFormProps) {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({
    query: '',
    breadth: 4,
    depth: 2,
    outputType: 'report',
    meshRestrictiveness: 'medium',
    followUpAnswers: [],
  });
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);

  const handleQuerySubmit = async (query: string) => {
    setFormData({ ...formData, query });
    
    // In a real implementation, we would fetch follow-up questions from the API
    // For now, we'll use some sample questions
    setFollowUpQuestions([
      { id: '1', question: 'Are you interested in including both clinically approved treatments and those still in experimental or trial stages?' },
      { id: '2', question: 'Would you like to focus exclusively on pharmacological interventions or also include non-pharmacological therapies?' },
      { id: '3', question: 'Should the research scope be global or tailored to specific geographical regions or clinical guidelines?' },
    ]);
    
    setStep(2);
  };

  const handleParametersSubmit = (parameters: Partial<FormData>) => {
    setFormData({ ...formData, ...parameters });
    setStep(3);
  };

  const handleFollowUpSubmit = (answers: string[]) => {
    setFormData({ ...formData, followUpAnswers: answers });
    onSubmit({ ...formData, followUpAnswers: answers });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {step === 1 && (
        <QueryStep 
          initialQuery={formData.query} 
          onSubmit={handleQuerySubmit} 
        />
      )}
      
      {step === 2 && (
        <ParametersStep 
          initialParameters={{
            breadth: formData.breadth,
            depth: formData.depth,
            outputType: formData.outputType,
            meshRestrictiveness: formData.meshRestrictiveness,
          }}
          onSubmit={handleParametersSubmit}
        />
      )}
      
      {step === 3 && (
        <FollowUpStep 
          questions={followUpQuestions}
          initialAnswers={formData.followUpAnswers}
          onSubmit={handleFollowUpSubmit}
        />
      )}
      
      <div className="mt-6 flex justify-between">
        <div className="text-sm text-gray-500">
          Step {step} of 3
        </div>
        <div className="flex space-x-2">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
