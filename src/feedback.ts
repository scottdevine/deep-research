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
      prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Format your response as a JSON object with a 'questions' array containing the questions as strings. Do not wrap your response in markdown code blocks or any other formatting: <query>${query}</query>`,
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

    try {
      // Try to extract JSON from markdown code blocks if that's the issue
      if (error.cause?.text) {
        const jsonMatch = error.cause.text.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            const parsedJson = JSON.parse(jsonMatch[1]);
            if (parsedJson.questions && Array.isArray(parsedJson.questions)) {
              return parsedJson.questions.slice(0, numQuestions);
            }
          } catch (jsonError) {
            console.log('Failed to parse extracted JSON:', jsonError);
          }
        }
      }

      // Fallback to text generation and parsing
      const response = await generateText({
        model: getModel(modelId),
        system: systemPrompt(),
        prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear. Number each question (1., 2., 3.) and put each on a new line. Do not include any other text or explanations: <query>${query}</query>`,
      });

      // Parse the text response to extract questions
      const questions = [];

      if (response && response.content) {
        const lines = response.content.split('\n');

        for (const line of lines) {
          // Look for lines that start with a number followed by a period or parenthesis
          const match = line.match(/^\s*\d+[.)]\s*(.+)/);
          if (match && match[1]) {
            questions.push(match[1].trim());
          }
        }
      }

      // If we couldn't parse any questions, generate topic-specific questions for the 340B program
      if (questions.length === 0 && query.toLowerCase().includes('340b')) {
        return [
          "What specific aspects of the 340B program's impact on the pharmaceutical industry are you most interested in (e.g., financial implications, drug pricing, patient access)?",
          "Are you interested in recent legal challenges or policy changes to the 340B program, or its general operation and effects?",
          "Would you like the research to focus on specific stakeholders such as hospitals, pharmaceutical manufacturers, contract pharmacies, or patients?"
        ].slice(0, numQuestions);
      }

      return questions.length > 0 ? questions.slice(0, numQuestions) : [
        "What specific timeframe are you interested in for this research?",
        "Are there particular aspects of this topic you'd like to focus on?",
        "Would you like the research to include international perspectives or focus on a specific region?"
      ].slice(0, numQuestions);
    } catch (fallbackError) {
      console.error('Error in fallback question generation:', fallbackError);

      // Ultimate fallback - return generic questions
      return [
        "What specific timeframe are you interested in for this research?",
        "Are there particular aspects of this topic you'd like to focus on?",
        "Would you like the research to include international perspectives or focus on a specific region?"
      ].slice(0, numQuestions);
    }
  }
}
