'use client';

import { useState } from 'react';
import { FollowUpQuestion } from './ResearchForm';

interface FollowUpStepProps {
  questions: FollowUpQuestion[];
  initialAnswers: string[];
  onSubmit: (answers: string[]) => void;
}

export default function FollowUpStep({ questions, initialAnswers, onSubmit }: FollowUpStepProps) {
  const [answers, setAnswers] = useState<string[]>(
    initialAnswers.length === questions.length
      ? initialAnswers
      : Array(questions.length).fill('')
  );
  const [errors, setErrors] = useState<string[]>(Array(questions.length).fill(''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all answers are provided
    const newErrors = answers.map((answer, index) => 
      answer.trim() ? '' : 'Please provide an answer'
    );
    
    setErrors(newErrors);
    
    if (newErrors.some(error => error)) {
      return;
    }
    
    onSubmit(answers);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    
    if (value.trim()) {
      const newErrors = [...errors];
      newErrors[index] = '';
      setErrors(newErrors);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Follow-up Questions</h2>
        <p className="mt-1 text-sm text-gray-500">
          To better understand your research needs, please answer these follow-up questions.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-2">
            <label htmlFor={`answer-${index}`} className="block text-sm font-medium text-gray-700">
              {question.question}
            </label>
            <textarea
              id={`answer-${index}`}
              rows={2}
              className={`block w-full rounded-md border ${
                errors[index] ? 'border-red-300' : 'border-gray-300'
              } shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2`}
              placeholder="Your answer"
              value={answers[index]}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
            />
            {errors[index] && <p className="mt-1 text-sm text-red-600">{errors[index]}</p>}
          </div>
        ))}
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Start Research
          </button>
        </div>
      </form>
    </div>
  );
}
