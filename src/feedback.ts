import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { getModel } from './ai/providers';
import { systemPrompt } from './prompt';

export async function generateFeedback({
  query,
  numQuestions = 3,
  modelId, // Add modelId parameter
}: {
  query: string;
  numQuestions?: number;
  modelId?: string; // Make it optional
}) {
  try {
    // First try with the structured schema approach
    const userFeedback = await generateObject({
      model: getModel(modelId), // Pass the modelId to getModel
      system: systemPrompt(),
      prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Format your response as a JSON object with a 'questions' array containing the questions as strings: <query>${query}</query>`,
      schema: z.object({
        questions: z
          .array(z.string())
          .describe(
            `Follow up questions to clarify the research direction, max of ${numQuestions}`,
          ),
      }),
    });

    return userFeedback.object.questions.slice(0, numQuestions);
  } catch (error) {
    console.log('Error generating structured questions, falling back to text parsing:', error);

    // Fallback to text generation and parsing
    const { content } = await generateText({
      model: getModel(modelId),
      system: systemPrompt(),
      prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Number each question and put each on a new line: <query>${query}</query>`,
    });

    // Parse the text response to extract questions
    const questions = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Look for lines that start with a number followed by a period or parenthesis
      const match = line.match(/^\s*\d+[.)]\s*(.+)/);
      if (match && match[1]) {
        questions.push(match[1].trim());
      }
    }

    return questions.slice(0, numQuestions);
  }
}
