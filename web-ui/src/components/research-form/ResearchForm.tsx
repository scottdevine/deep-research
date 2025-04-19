'use client';

import { useState } from 'react';
import QueryStep from './QueryStep';
import ParametersStep from './ParametersStep';
import FollowUpStep from './FollowUpStep';

export type FormData = {
  query: string;
  breadth: number;
  depth: number;
  insightDetail: number; // Add the insightDetail parameter
  modelId?: string; // Add the model parameter
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
    insightDetail: 5, // Add the insightDetail parameter with default value 5
    modelId: '', // Default to empty string (will use default model)
    outputType: 'report',
    meshRestrictiveness: 'medium',
    followUpAnswers: [],
  });
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);

  const handleQuerySubmit = (query: string) => {
    setFormData({ ...formData, query });
    setStep(2);
  };

  const handleParametersSubmit = async (parameters: Partial<FormData>) => {
    // Update form data with the selected parameters
    const updatedFormData = { ...formData, ...parameters };
    setFormData(updatedFormData);

    // Show loading state
    setIsLoadingQuestions(true);

    try {
      // Now that we have the model ID, fetch follow-up questions from the API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051'}/api/questions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: updatedFormData.query,
          modelId: updatedFormData.modelId // Pass the selected model ID
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Map the questions to the expected format
      const questions = data.questions.map((question: string, index: number) => ({
        id: String(index + 1),
        question,
      }));

      setFollowUpQuestions(questions);
    } catch (error) {
      console.error('Error fetching follow-up questions:', error);
      // Fallback to sample questions if the API call fails
      setFollowUpQuestions([
        { id: '1', question: 'Are you interested in including both clinically approved treatments and those still in experimental or trial stages?' },
        { id: '2', question: 'Would you like to focus exclusively on pharmacological interventions or also include non-pharmacological therapies?' },
        { id: '3', question: 'Should the research scope be global or tailored to specific geographical regions or clinical guidelines?' },
      ]);
    } finally {
      // Hide loading state
      setIsLoadingQuestions(false);

      // Move to the follow-up questions step
      setStep(3);
    }
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
            insightDetail: formData.insightDetail, // Add the insightDetail parameter
            modelId: formData.modelId, // Add the model parameter
            outputType: formData.outputType,
            meshRestrictiveness: formData.meshRestrictiveness,
          }}
          onSubmit={handleParametersSubmit}
          isLoading={isLoadingQuestions}
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
