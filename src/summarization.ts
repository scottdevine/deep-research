import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from './ai/providers';
import { systemPrompt } from './prompt';
import { LayeredLearning, StructuredLearning, TopicSummary } from './types';

/**
 * Generate a brief summary (1-2 sentences) of a learning
 */
export async function generateBriefSummary(learning: StructuredLearning): Promise<string> {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Summarize the following learning in 1-2 concise sentences that capture the most important information:

Title: ${learning.title}
Content: ${learning.content}`,
    schema: z.object({
      briefSummary: z.string().describe('A 1-2 sentence summary of the learning'),
    }),
  });

  return res.object.briefSummary;
}

/**
 * Generate a moderate summary (paragraph) of a learning
 */
export async function generateModerateSummary(learning: StructuredLearning): Promise<string> {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Summarize the following learning in a single paragraph (4-6 sentences) that captures the key points and important details:

Title: ${learning.title}
Content: ${learning.content}`,
    schema: z.object({
      moderateSummary: z.string().describe('A paragraph-length summary of the learning'),
    }),
  });

  return res.object.moderateSummary;
}

/**
 * Generate topic-level summaries grouping related learnings
 */
export async function generateTopicSummaries(
  layeredLearnings: LayeredLearning[]
): Promise<TopicSummary[]> {
  // Group learnings by topic
  const topicGroups: Record<string, LayeredLearning[]> = {};
  
  for (const learning of layeredLearnings) {
    for (const topic of learning.topics) {
      if (!topicGroups[topic]) {
        topicGroups[topic] = [];
      }
      topicGroups[topic].push(learning);
    }
  }
  
  // Generate a summary for each topic
  const topicSummaries: TopicSummary[] = [];
  
  for (const topic of Object.keys(topicGroups)) {
    const learningsForTopic = topicGroups[topic];
    
    // Use moderate summaries as input to avoid token limits
    const summaryInput = learningsForTopic
      .map(l => l.summaries.moderate)
      .join('\n\n');
    
    const res = await generateObject({
      model: getModel(),
      system: systemPrompt(),
      prompt: `Generate a comprehensive summary about the topic "${topic}" based on the following research learnings:

${summaryInput}`,
      schema: z.object({
        topicSummary: z.string().describe(`A comprehensive summary about the topic "${topic}"`),
      }),
    });
    
    topicSummaries.push({
      topic,
      summary: res.object.topicSummary,
      relatedLearnings: learningsForTopic.map(l => l.id),
    });
  }
  
  return topicSummaries;
}

/**
 * Generate a depth-specific research summary
 */
export async function generateDepthSummary(
  layeredLearnings: LayeredLearning[],
  depth: number
): Promise<string> {
  // Adjust the level of detail based on research depth
  const summaryType = depth <= 1 ? 'brief' : depth <= 3 ? 'moderate' : 'detailed';
  
  // Use the appropriate summary level as input
  const summaryInput = layeredLearnings
    .map(l => l.summaries[summaryType as keyof typeof l.summaries])
    .join('\n\n');
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Generate a comprehensive research summary based on the following learnings. This summary should reflect a research depth of ${depth} (on a scale of 1-5), with appropriate detail and scope:

${summaryInput}`,
    schema: z.object({
      depthSummary: z.string().describe(`A comprehensive research summary reflecting depth level ${depth}`),
    }),
  });
  
  return res.object.depthSummary;
}

/**
 * Extract the most important insights across all learnings
 */
export async function extractKeyInsights(
  layeredLearnings: LayeredLearning[]
): Promise<string[]> {
  // Sort learnings by importance
  const sortedLearnings = [...layeredLearnings].sort((a, b) => b.importance - a.importance);
  
  // Take the top 50% of learnings
  const topLearnings = sortedLearnings.slice(0, Math.ceil(sortedLearnings.length / 2));
  
  // Use brief summaries to avoid token limits
  const summaryInput = topLearnings
    .map(l => l.summaries.brief)
    .join('\n\n');
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Extract the 5-10 most important insights from the following research learnings. Each insight should be a concise statement that captures a key finding or conclusion:

${summaryInput}`,
    schema: z.object({
      keyInsights: z.array(z.string()).describe('List of 5-10 key insights extracted from the research'),
    }),
  });
  
  return res.object.keyInsights;
}

/**
 * Apply progressive summarization to a set of learnings
 */
export async function progressiveSummarization(
  learnings: StructuredLearning[],
  depth: number
): Promise<{
  layeredLearnings: LayeredLearning[];
  topicSummaries: TopicSummary[];
  depthSummary: string;
  keyInsights: string[];
}> {
  // 1. Create multi-layered summaries for each learning
  const layeredLearnings: LayeredLearning[] = [];
  
  for (const learning of learnings) {
    const briefSummary = await generateBriefSummary(learning);
    const moderateSummary = await generateModerateSummary(learning);
    
    layeredLearnings.push({
      ...learning,
      summaries: {
        brief: briefSummary,
        moderate: moderateSummary,
        detailed: learning.content
      }
    });
  }
  
  // 2. Generate topic-level summaries grouping related learnings
  const topicSummaries = await generateTopicSummaries(layeredLearnings);
  
  // 3. Create depth-specific research summary
  const depthSummary = await generateDepthSummary(layeredLearnings, depth);
  
  // 4. Tag the most important insights across all learnings
  const keyInsights = await extractKeyInsights(layeredLearnings);
  
  return {
    layeredLearnings,
    topicSummaries,
    depthSummary,
    keyInsights
  };
}
