import { StructuredLearning } from './types';

/**
 * Calculate an importance score for a learning based on multiple criteria
 */
export function calculateImportanceScore(learning: StructuredLearning): number {
  // Start with the explicit importance rating if available
  let score = learning.importance || 5;
  
  // Adjust based on other factors
  
  // 1. Source diversity - more sources generally means more important/verified information
  score += Math.min(learning.sources.length, 5) * 0.2;
  
  // 2. Key points - more key points suggests more valuable information
  score += Math.min(learning.keyPoints.length, 10) * 0.1;
  
  // 3. Content length - longer content may contain more valuable information
  // (but with diminishing returns)
  const contentLength = learning.content.length;
  score += Math.min(contentLength / 500, 2) * 0.5;
  
  // 4. Confidence score - higher confidence means more reliable information
  score += (learning.metadata.confidenceScore || 0.5) * 2;
  
  // 5. Content type bonus - analytical content often provides more insight
  if (learning.metadata.contentType === 'analytical') {
    score += 1;
  }
  
  // Ensure score stays within 1-10 range
  return Math.max(1, Math.min(10, score));
}

/**
 * Group learnings by topics to ensure topical coverage
 */
export function groupByTopics(
  scoredLearnings: (StructuredLearning & { importanceScore: number })[]
): Record<string, (StructuredLearning & { importanceScore: number })[]> {
  const topicGroups: Record<string, (StructuredLearning & { importanceScore: number })[]> = {};
  
  for (const learning of scoredLearnings) {
    for (const topic of learning.topics) {
      if (!topicGroups[topic]) {
        topicGroups[topic] = [];
      }
      topicGroups[topic].push(learning);
    }
  }
  
  // Sort each group by importance score
  for (const topic of Object.keys(topicGroups)) {
    topicGroups[topic].sort((a, b) => b.importanceScore - a.importanceScore);
  }
  
  return topicGroups;
}

/**
 * Select representative learnings from each topic group
 */
export function selectRepresentativeLearnings(
  topicGroups: Record<string, (StructuredLearning & { importanceScore: number })[]>,
  maxContentSize: number
): StructuredLearning[] {
  const selectedLearnings: StructuredLearning[] = [];
  const selectedIds = new Set<string>();
  
  // Calculate total content size
  const calculateContentSize = (learnings: StructuredLearning[]): number => {
    return learnings.reduce((total, learning) => total + learning.content.length, 0);
  };
  
  // Sort topics by importance (using the average importance of top 3 learnings)
  const topicImportance = Object.entries(topicGroups).map(([topic, learnings]) => {
    const topLearnings = learnings.slice(0, Math.min(3, learnings.length));
    const avgImportance = topLearnings.reduce((sum, l) => sum + l.importanceScore, 0) / topLearnings.length;
    return { topic, avgImportance };
  });
  
  topicImportance.sort((a, b) => b.avgImportance - a.avgImportance);
  
  // First pass: select the most important learning from each topic
  for (const { topic } of topicImportance) {
    const learnings = topicGroups[topic];
    if (learnings.length === 0) continue;
    
    // Find the most important learning that hasn't been selected yet
    const learning = learnings.find(l => !selectedIds.has(l.id));
    if (learning) {
      selectedLearnings.push(learning);
      selectedIds.add(learning.id);
    }
  }
  
  // Check if we're within the content size limit
  if (calculateContentSize(selectedLearnings) >= maxContentSize) {
    return selectedLearnings;
  }
  
  // Second pass: add more learnings from each topic in order of importance
  let currentSize = calculateContentSize(selectedLearnings);
  let topicIndex = 0;
  
  while (currentSize < maxContentSize && topicIndex < topicImportance.length) {
    const { topic } = topicImportance[topicIndex];
    const learnings = topicGroups[topic];
    
    // Find the next most important learning that hasn't been selected yet
    const learning = learnings.find(l => !selectedIds.has(l.id));
    
    if (learning) {
      // Check if adding this learning would exceed the limit
      if (currentSize + learning.content.length <= maxContentSize) {
        selectedLearnings.push(learning);
        selectedIds.add(learning.id);
        currentSize += learning.content.length;
      }
    }
    
    // Move to the next topic (round-robin)
    topicIndex = (topicIndex + 1) % topicImportance.length;
    
    // If we've gone through all topics without adding anything, break
    if (topicIndex === 0 && currentSize === calculateContentSize(selectedLearnings)) {
      break;
    }
  }
  
  return selectedLearnings;
}

/**
 * Ensure diversity of content types (facts, analysis, concepts)
 */
export function ensureContentDiversity(
  selectedLearnings: StructuredLearning[]
): StructuredLearning[] {
  // Count the number of learnings of each content type
  const typeCounts = {
    factual: 0,
    analytical: 0,
    conceptual: 0
  };
  
  for (const learning of selectedLearnings) {
    typeCounts[learning.metadata.contentType]++;
  }
  
  // If we have a good balance, return as is
  const total = selectedLearnings.length;
  const minPercentage = 0.2; // At least 20% of each type
  
  if (
    typeCounts.factual / total >= minPercentage &&
    typeCounts.analytical / total >= minPercentage &&
    typeCounts.conceptual / total >= minPercentage
  ) {
    return selectedLearnings;
  }
  
  // Otherwise, we need to adjust the selection
  // First, identify the underrepresented types
  const underrepresented = Object.entries(typeCounts)
    .filter(([_, count]) => count / total < minPercentage)
    .map(([type]) => type as 'factual' | 'analytical' | 'conceptual');
  
  // Then, identify the overrepresented types
  const overrepresented = Object.entries(typeCounts)
    .filter(([_, count]) => count / total > (1 - minPercentage * underrepresented.length) / (3 - underrepresented.length))
    .map(([type]) => type as 'factual' | 'analytical' | 'conceptual');
  
  // If we have both underrepresented and overrepresented types, we can adjust
  if (underrepresented.length > 0 && overrepresented.length > 0) {
    // Sort learnings by importance within each type
    const learningsByType: Record<string, StructuredLearning[]> = {
      factual: [],
      analytical: [],
      conceptual: []
    };
    
    for (const learning of selectedLearnings) {
      learningsByType[learning.metadata.contentType].push(learning);
    }
    
    // Sort each type by importance (descending)
    for (const type in learningsByType) {
      learningsByType[type as keyof typeof learningsByType].sort(
        (a, b) => b.importance - a.importance
      );
    }
    
    // Calculate how many learnings to replace
    const targetCount = Math.ceil(total * minPercentage);
    const toReplace = Math.min(
      Math.floor(total * 0.2), // Replace at most 20% of learnings
      underrepresented.reduce((sum, type) => sum + (targetCount - typeCounts[type]), 0)
    );
    
    // Replace the least important learnings of overrepresented types
    // with the most important learnings of underrepresented types that aren't already selected
    const result = [...selectedLearnings];
    
    // Remove the least important learnings of overrepresented types
    for (let i = 0; i < toReplace; i++) {
      // Find the least important learning of an overrepresented type
      let leastImportantIndex = -1;
      let leastImportance = Infinity;
      
      for (let j = 0; j < result.length; j++) {
        const learning = result[j];
        if (
          overrepresented.includes(learning.metadata.contentType) &&
          learning.importance < leastImportance
        ) {
          leastImportantIndex = j;
          leastImportance = learning.importance;
        }
      }
      
      if (leastImportantIndex >= 0) {
        result.splice(leastImportantIndex, 1);
      }
    }
    
    // Add learnings of underrepresented types
    for (const type of underrepresented) {
      const needed = targetCount - typeCounts[type];
      if (needed <= 0) continue;
      
      // Find learnings of this type that aren't already in the result
      const availableLearnings = learningsByType[type].filter(
        learning => !result.some(l => l.id === learning.id)
      );
      
      // Add the most important ones
      for (let i = 0; i < Math.min(needed, availableLearnings.length); i++) {
        result.push(availableLearnings[i]);
      }
    }
    
    return result;
  }
  
  // If we can't adjust, return the original selection
  return selectedLearnings;
}

/**
 * Calculate the maximum content size based on insight detail level
 */
export function calculateMaxContentSize(insightDetail: number): number {
  // Base size for minimal detail
  const baseSize = 10000; // ~2000 words
  
  // Scale up based on insight detail
  // Detail 1: ~10,000 chars (~2,000 words)
  // Detail 5: ~50,000 chars (~10,000 words)
  // Detail 10: ~100,000 chars (~20,000 words)
  return baseSize * (1 + (insightDetail - 1) * 0.9);
}

/**
 * Select important content from a set of learnings
 */
export function selectImportantContent(
  learnings: StructuredLearning[],
  maxContentSize: number
): StructuredLearning[] {
  // 1. Score each learning based on multiple criteria
  const scoredLearnings = learnings.map(learning => ({
    ...learning,
    importanceScore: calculateImportanceScore(learning)
  }));
  
  // 2. Group learnings by topics to ensure topical coverage
  const topicGroups = groupByTopics(scoredLearnings);
  
  // 3. Select representative learnings from each topic group
  const selectedLearnings = selectRepresentativeLearnings(topicGroups, maxContentSize);
  
  // 4. Ensure diversity of content types (facts, analysis, concepts)
  return ensureContentDiversity(selectedLearnings);
}
