import { generateObject } from 'ai';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getModel } from './ai/providers';
import { systemPrompt } from './prompt';
import { PubMedArticle } from './pubmed';
import { ReportOutline, ReportSection, StructuredLearning } from './types';

/**
 * Generate a report outline based on the research topic and learnings
 */
export async function generateReportOutline(
  prompt: string,
  learnings: StructuredLearning[]
): Promise<ReportOutline> {
  // Extract topics from learnings
  const topics = new Set<string>();
  learnings.forEach(learning => {
    learning.topics.forEach(topic => topics.add(topic));
  });
  
  // Create a sample of learning titles to inform the outline
  const sampleTitles = learnings
    .slice(0, Math.min(20, learnings.length))
    .map(l => l.title);
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Generate a comprehensive report outline for a research report on the following topic:

Research Topic: ${prompt}

The report should cover these key topics identified in the research:
${Array.from(topics).map(t => `- ${t}`).join('\n')}

Here are some sample findings from the research:
${sampleTitles.map(t => `- ${t}`).join('\n')}

Create a well-structured outline with:
1. A main title for the report
2. 5-10 main sections (including Introduction and Conclusion)
3. Appropriate subsections for each main section
4. Each section and subsection should have a descriptive title and a brief description of its purpose

The outline should be comprehensive and cover all important aspects of the topic.`,
    schema: z.object({
      title: z.string().describe('The main title of the report'),
      sections: z.array(z.object({
        id: z.string().describe('Unique identifier for this section'),
        title: z.string().describe('Title of this section'),
        description: z.string().describe('Brief description of what this section covers'),
        subsections: z.array(z.object({
          id: z.string().describe('Unique identifier for this subsection'),
          title: z.string().describe('Title of this subsection'),
          description: z.string().describe('Brief description of what this subsection covers'),
        })).describe('Subsections within this main section'),
      })).describe('Main sections of the report'),
    }),
  });

  // Ensure all sections and subsections have valid IDs
  const sections = res.object.sections.map(section => {
    const sectionWithId = {
      ...section,
      id: section.id || uuidv4(),
    };
    
    const subsections = section.subsections.map(subsection => ({
      ...subsection,
      id: subsection.id || uuidv4(),
    }));
    
    return {
      ...sectionWithId,
      subsections,
    };
  });

  return {
    title: res.object.title,
    sections,
  };
}

/**
 * Categorize learnings according to outline sections
 */
export async function categorizeLearnigsBySection(
  learnings: StructuredLearning[],
  sections: ReportSection[]
): Promise<Record<string, StructuredLearning[]>> {
  const result: Record<string, StructuredLearning[]> = {};
  
  // Initialize result with empty arrays for each section and subsection
  sections.forEach(section => {
    result[section.id] = [];
    
    section.subsections.forEach(subsection => {
      result[subsection.id] = [];
    });
  });
  
  // For each learning, determine which sections it belongs to
  for (const learning of learnings) {
    // Create a description of all sections and subsections
    const sectionsDescription = sections.map(section => {
      const subsectionsText = section.subsections.map(sub => 
        `    - ${sub.id}: ${sub.title} - ${sub.description}`
      ).join('\n');
      
      return `  * ${section.id}: ${section.title} - ${section.description}\n${subsectionsText}`;
    }).join('\n');
    
    // Use AI to categorize this learning
    const res = await generateObject({
      model: getModel(),
      system: systemPrompt(),
      prompt: `Determine which sections and subsections of the report outline this research learning belongs to. A learning can belong to multiple sections if relevant.

Report Outline:
${sectionsDescription}

Learning:
Title: ${learning.title}
Content: ${learning.content}
Topics: ${learning.topics.join(', ')}
Key Points: ${learning.keyPoints.join(', ')}

For each section or subsection where this learning belongs, provide the section ID and a brief explanation of why it fits there.`,
      schema: z.object({
        relevantSections: z.array(z.object({
          sectionId: z.string().describe('ID of the relevant section or subsection'),
          reason: z.string().describe('Brief explanation of why this learning belongs in this section'),
        })).describe('List of sections and subsections where this learning belongs'),
      }),
    });
    
    // Assign the learning to the relevant sections
    for (const { sectionId } of res.object.relevantSections) {
      if (result[sectionId]) {
        result[sectionId].push(learning);
      }
    }
  }
  
  return result;
}

/**
 * Process content for a section with its relevant learnings
 */
export async function processSectionContent(
  section: ReportSection,
  sectionLearnings: StructuredLearning[],
  insightDetail: number
): Promise<string> {
  // If no learnings for this section, generate placeholder content
  if (sectionLearnings.length === 0) {
    return `## ${section.title}\n\n${section.description}\n\n*No specific research findings were available for this section.*`;
  }
  
  // Determine detail level based on insight detail parameter
  const detailLevel = insightDetail <= 3 ? 'concise' : 
                     insightDetail <= 7 ? 'detailed' : 
                     'comprehensive';
  
  // Prepare learning content
  const learningContent = sectionLearnings.map(learning => {
    const sourcesList = learning.sources.length > 0 
      ? `\nSources: ${learning.sources.join(', ')}` 
      : '';
    
    return `Title: ${learning.title}
Content: ${learning.content}
Key Points: ${learning.keyPoints.join(', ')}${sourcesList}`;
  }).join('\n\n---\n\n');
  
  // Generate section content
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Write a ${detailLevel} section for a research report based on the following learnings. The section should be well-structured, informative, and include proper citations to the sources.

Section Title: ${section.title}
Section Purpose: ${section.description}

Research Learnings:
${learningContent}

Guidelines:
1. Start with a brief introduction to the section topic
2. Organize the content logically, covering all key aspects from the learnings
3. Include all important information from the learnings
4. Use proper citations for all factual statements (format: [Source])
5. Write in a professional, academic style
6. Include appropriate subheadings if needed
7. The level of detail should be ${detailLevel} (insight detail: ${insightDetail}/10)
8. End with a brief summary of the section's key points

Format the section in Markdown, starting with a level 2 heading (##) for the section title.`,
    schema: z.object({
      sectionContent: z.string().describe(`The ${detailLevel} content for the "${section.title}" section`),
    }),
  });
  
  return res.object.sectionContent;
}

/**
 * Generate an executive summary for the report
 */
export async function generateExecutiveSummary(
  outline: ReportOutline,
  sectionContents: string[]
): Promise<string> {
  // Extract section titles for reference
  const sectionTitles = outline.sections.map(s => s.title).join(', ');
  
  // Create a condensed version of section contents to avoid token limits
  const condensedContents = sectionContents.map(content => {
    // Extract the first paragraph after the heading
    const match = content.match(/^##\s+.*?\n\n(.*?)(\n\n|$)/s);
    return match ? match[1] : content.substring(0, 200) + '...';
  }).join('\n\n');
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Generate a comprehensive executive summary for a research report on "${outline.title}". The report covers the following sections: ${sectionTitles}.

Here are condensed excerpts from each section:
${condensedContents}

The executive summary should:
1. Provide an overview of the research purpose and scope
2. Summarize the key findings from each major section
3. Highlight the most important insights and implications
4. Be comprehensive yet concise (400-600 words)
5. Be written in a professional, academic style
6. Stand alone as a complete summary of the entire report

Format the executive summary in Markdown, starting with a level 2 heading (##).`,
    schema: z.object({
      executiveSummary: z.string().describe('A comprehensive executive summary of the research report'),
    }),
  });
  
  return res.object.executiveSummary;
}

/**
 * Create a references section for the report
 */
export function createReferencesSection(
  webSources: string[],
  pubMedArticles: PubMedArticle[]
): string {
  let sourcesSection = `\n\n## References\n\n`;
  
  // Add web sources
  if (webSources.length > 0) {
    sourcesSection += `### Web Sources\n\n`;
    sourcesSection += webSources.map((url, index) => {
      return `[web${index + 1}] ${url}`;
    }).join('\n\n');
  }
  
  // Add PubMed citations if available
  if (pubMedArticles.length > 0) {
    sourcesSection += '\n\n### PubMed Citations\n\n';
    sourcesSection += pubMedArticles.map((article, index) => {
      return `[pubmed${index + 1}] ${article.authors?.join(', ') || '[No authors listed]'}. ${article.title}. ${article.journal || '[Journal not specified]'}. ${article.publicationDate || '[Date not specified]'}. ${article.doi ? `doi: ${article.doi}` : ''}\n   [PubMed Link](${article.url})`;
    }).join('\n\n');
  }
  
  return sourcesSection;
}

/**
 * Assemble the final structured report
 */
export function assembleStructuredReport(
  outline: ReportOutline,
  executiveSummary: string,
  sectionContents: string[],
  visitedUrls: string[],
  pubMedArticles: PubMedArticle[]
): string {
  // Create title and metadata
  let report = `# ${outline.title}\n\n---\n\n`;
  
  // Add executive summary
  report += `${executiveSummary}\n\n---\n\n`;
  
  // Add table of contents
  report += `## Table of Contents\n\n`;
  
  outline.sections.forEach((section, index) => {
    report += `${index + 1}. ${section.title}\n`;
    
    section.subsections.forEach((subsection, subIndex) => {
      report += `   ${String.fromCharCode(97 + subIndex)}. ${subsection.title}\n`;
    });
  });
  
  report += `\n---\n\n`;
  
  // Add section contents
  outline.sections.forEach((section, index) => {
    report += `${sectionContents[index]}\n\n`;
  });
  
  // Add references
  report += createReferencesSection(visitedUrls, pubMedArticles);
  
  // Add footer
  report += `\n\n---\n\n*This report is prepared to provide a comprehensive, detailed, and academically rigorous overview of the topic, integrating all available research learnings and sources.*\n\n`;
  
  return report;
}

/**
 * Write a final report using chunked processing
 */
export async function writeFinalReportWithChunking({
  prompt,
  learnings,
  visitedUrls,
  pubMedArticles = [],
  insightDetail = 5,
}: {
  prompt: string;
  learnings: StructuredLearning[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
  insightDetail?: number;
}): Promise<string> {
  // 1. Create a report outline with major sections based on the research topic
  const reportOutline = await generateReportOutline(prompt, learnings);
  
  // 2. Categorize learnings according to outline sections
  const categorizedLearnings = await categorizeLearnigsBySection(learnings, reportOutline.sections);
  
  // 3. Process each section independently with relevant learnings
  const sectionContents = await Promise.all(
    reportOutline.sections.map(async (section) => {
      const sectionLearnings = categorizedLearnings[section.id] || [];
      return processSectionContent(section, sectionLearnings, insightDetail);
    })
  );
  
  // 4. Generate an executive summary that captures key findings across all sections
  const executiveSummary = await generateExecutiveSummary(reportOutline, sectionContents);
  
  // 5. Assemble the final report with proper structure
  const finalReport = assembleStructuredReport(
    reportOutline,
    executiveSummary,
    sectionContents,
    visitedUrls,
    pubMedArticles
  );
  
  return finalReport;
}
