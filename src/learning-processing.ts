import { generateObject } from 'ai';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getModel } from './ai/providers';
import { systemPrompt } from './prompt';
import { StructuredLearning, TopicNode } from './types';

/**
 * Extract key topics from a set of learnings
 */
export async function extractKeyTopics(
  learnings: StructuredLearning[]
): Promise<string[]> {
  // If learnings already have topics, use those
  const existingTopics = new Set<string>();
  learnings.forEach(learning => {
    learning.topics.forEach(topic => existingTopics.add(topic));
  });

  // If we have enough topics, return them
  if (existingTopics.size >= 5) {
    return Array.from(existingTopics);
  }

  // Otherwise, generate topics using AI
  const learningTexts = learnings.map(l => `${l.title}\n${l.content}`).join('\n\n');
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Extract the main topics from the following research learnings. Identify 5-10 key topics that represent the main themes and concepts covered in these learnings. Each topic should be a short phrase (2-5 words).\n\n${learningTexts}`,
    schema: z.object({
      topics: z.array(z.string()).describe('List of 5-10 key topics extracted from the learnings'),
    }),
  });

  return [...new Set([...Array.from(existingTopics), ...res.object.topics])];
}

/**
 * Cluster learnings by semantic similarity to topics
 */
export async function clusterLearningsBySimilarity(
  learnings: StructuredLearning[],
  topics: string[]
): Promise<Record<string, StructuredLearning[]>> {
  // Initialize clusters
  const clusters: Record<string, StructuredLearning[]> = {};
  topics.forEach(topic => {
    clusters[topic] = [];
  });

  // For each learning, determine which topics it relates to
  for (const learning of learnings) {
    // If learning already has topics, use those
    if (learning.topics && learning.topics.length > 0) {
      for (const topic of learning.topics) {
        // Find the closest matching topic from our list
        const matchingTopic = findClosestMatchingTopic(topic, topics);
        if (matchingTopic) {
          clusters[matchingTopic].push(learning);
        }
      }
    } else {
      // Otherwise, use AI to determine relevant topics
      const relevantTopics = await findRelevantTopics(learning, topics);
      for (const topic of relevantTopics) {
        clusters[topic].push(learning);
      }
      
      // Update the learning with these topics
      learning.topics = relevantTopics;
    }
  }

  return clusters;
}

/**
 * Find the closest matching topic from a list
 */
function findClosestMatchingTopic(topic: string, topics: string[]): string | null {
  // Simple matching for now - could be enhanced with embeddings
  const lowerTopic = topic.toLowerCase();
  
  // Exact match
  const exactMatch = topics.find(t => t.toLowerCase() === lowerTopic);
  if (exactMatch) return exactMatch;
  
  // Contains match
  const containsMatch = topics.find(t => 
    t.toLowerCase().includes(lowerTopic) || 
    lowerTopic.includes(t.toLowerCase())
  );
  if (containsMatch) return containsMatch;
  
  // Word overlap match
  const topicWords = new Set(lowerTopic.split(/\s+/));
  let bestMatch = null;
  let bestOverlap = 0;
  
  for (const t of topics) {
    const tWords = new Set(t.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const word of topicWords) {
      if (tWords.has(word)) overlap++;
    }
    for (const word of tWords) {
      if (topicWords.has(word)) overlap++;
    }
    
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = t;
    }
  }
  
  return bestOverlap > 0 ? bestMatch : null;
}

/**
 * Find relevant topics for a learning using AI
 */
async function findRelevantTopics(
  learning: StructuredLearning,
  topics: string[]
): Promise<string[]> {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Determine which of the following topics are most relevant to this learning. Select only the topics that are directly related to the content of the learning. Return the exact topic names as they appear in the list.

Learning: ${learning.title}
${learning.content}

Topics:
${topics.map(t => `- ${t}`).join('\n')}`,
    schema: z.object({
      relevantTopics: z.array(z.string()).describe('List of topics from the provided list that are relevant to this learning'),
    }),
  });

  // Ensure all returned topics are in the original list
  return res.object.relevantTopics.filter(topic => topics.includes(topic));
}

/**
 * Build a hierarchical structure of topics and subtopics
 */
export async function buildTopicHierarchy(
  clusters: Record<string, StructuredLearning[]>
): Promise<TopicNode[]> {
  const topics = Object.keys(clusters);
  
  // For small numbers of topics, don't build a hierarchy
  if (topics.length <= 5) {
    return topics.map(topic => ({
      id: uuidv4(),
      topic,
      subtopics: [],
      learnings: clusters[topic],
    }));
  }
  
  // Use AI to organize topics into a hierarchy
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Organize the following topics into a hierarchical structure with main topics and subtopics. Group related topics together. Each main topic should have 0-3 subtopics.

Topics:
${topics.map(t => `- ${t}`).join('\n')}`,
    schema: z.object({
      mainTopics: z.array(z.object({
        mainTopic: z.string().describe('The name of the main topic'),
        subtopics: z.array(z.string()).describe('List of subtopics under this main topic'),
      })),
    }),
  });

  // Convert the AI response into our TopicNode structure
  const hierarchy: TopicNode[] = [];
  
  for (const mainTopic of res.object.mainTopics) {
    const mainTopicNode: TopicNode = {
      id: uuidv4(),
      topic: mainTopic.mainTopic,
      subtopics: [],
      learnings: clusters[mainTopic.mainTopic] || [],
    };
    
    // Add subtopics
    for (const subtopic of mainTopic.subtopics) {
      const subtopicNode: TopicNode = {
        id: uuidv4(),
        topic: subtopic,
        subtopics: [],
        learnings: clusters[subtopic] || [],
      };
      
      mainTopicNode.subtopics.push(subtopicNode);
    }
    
    hierarchy.push(mainTopicNode);
  }
  
  return hierarchy;
}

/**
 * Assign learnings to appropriate places in the hierarchy
 */
export function assignLearningsToHierarchy(
  learnings: StructuredLearning[],
  hierarchy: TopicNode[]
): TopicNode[] {
  // Create a map of all topics to their nodes for quick lookup
  const topicMap = new Map<string, TopicNode>();
  
  // Helper function to add all nodes to the map
  function addToMap(nodes: TopicNode[]) {
    for (const node of nodes) {
      topicMap.set(node.topic, node);
      if (node.subtopics.length > 0) {
        addToMap(node.subtopics);
      }
    }
  }
  
  addToMap(hierarchy);
  
  // For each learning, assign it to all relevant topic nodes
  for (const learning of learnings) {
    for (const topic of learning.topics) {
      const node = topicMap.get(topic);
      if (node) {
        // Check if this learning is already in the node
        if (!node.learnings.some(l => l.id === learning.id)) {
          node.learnings.push(learning);
        }
      }
    }
  }
  
  return hierarchy;
}

/**
 * Generate summaries for each level of the hierarchy
 */
export async function generateHierarchySummaries(
  hierarchy: TopicNode[]
): Promise<TopicNode[]> {
  // Process each main topic
  for (let i = 0; i < hierarchy.length; i++) {
    const node = hierarchy[i];
    
    // Generate summary for the main topic
    node.summary = await generateTopicSummary(node);
    
    // Process subtopics
    for (let j = 0; j < node.subtopics.length; j++) {
      const subtopic = node.subtopics[j];
      subtopic.summary = await generateTopicSummary(subtopic);
    }
  }
  
  return hierarchy;
}

/**
 * Generate a summary for a topic node
 */
async function generateTopicSummary(node: TopicNode): Promise<string> {
  if (node.learnings.length === 0) {
    return "No information available for this topic.";
  }
  
  // Combine learning content
  const learningTexts = node.learnings
    .map(l => `${l.title}\n${l.content}`)
    .join('\n\n');
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Generate a comprehensive summary of the following research learnings about "${node.topic}". The summary should capture the key points, findings, and insights from all the learnings.

${learningTexts}`,
    schema: z.object({
      summary: z.string().describe(`A comprehensive summary of the research learnings about ${node.topic}`),
    }),
  });
  
  return res.object.summary;
}

/**
 * Aggregate learnings into a hierarchical structure
 */
export async function aggregateHierarchicalLearnings(
  learnings: StructuredLearning[]
): Promise<TopicNode[]> {
  // 1. Extract key topics and concepts from learnings
  const topics = await extractKeyTopics(learnings);
  
  // 2. Create a clustering of learnings by semantic similarity
  const clusters = await clusterLearningsBySimilarity(learnings, topics);
  
  // 3. Build a hierarchical structure with main topics and subtopics
  const hierarchy = await buildTopicHierarchy(clusters);
  
  // 4. Assign each learning to appropriate places in the hierarchy
  const populatedHierarchy = assignLearningsToHierarchy(learnings, hierarchy);
  
  // 5. Generate summary content for each level of the hierarchy
  return generateHierarchySummaries(populatedHierarchy);
}
