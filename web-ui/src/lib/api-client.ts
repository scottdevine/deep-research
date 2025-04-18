import { FormData } from '@/components/research-form/ResearchForm';
import { ResearchResult } from '@/components/research-results/ResearchResults';

// Base URL for API requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051';

/**
 * Start a new research process
 */
export async function startResearch(formData: FormData): Promise<{ researchId: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: formData.query,
        breadth: formData.breadth,
        depth: formData.depth,
        meshRestrictiveness: formData.meshRestrictiveness,
        // Combine initial query with follow-up Q&A
        combinedQuery: `
Initial Query: ${formData.query}
Follow-up Questions and Answers:
${formData.followUpAnswers.map((answer, i) => `Q: Question ${i + 1}\nA: ${answer}`).join('\n')}
        `.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return { researchId: data.researchId };
  } catch (error) {
    console.error('Error starting research:', error);
    throw error;
  }
}

/**
 * Get research results
 */
export async function getResearchResults(researchId: string): Promise<ResearchResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/research/${researchId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting research results:', error);
    throw error;
  }
}

/**
 * Create an EventSource for progress updates
 */
export function createProgressEventSource(researchId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/api/research/progress/${researchId}`);
}

/**
 * Generate follow-up questions based on a query
 */
export async function generateFollowUpQuestions(query: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/questions/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error('Error generating follow-up questions:', error);
    throw error;
  }
}

/**
 * Export research results in different formats
 */
export async function exportResults(
  researchId: string,
  format: 'pdf' | 'markdown' | 'word'
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export/${format}/${researchId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    console.error(`Error exporting as ${format}:`, error);
    throw error;
  }
}
