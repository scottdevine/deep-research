import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from './ai/providers';
import { systemPrompt } from './prompt';
import { PubMedArticle } from './pubmed';
import { 
  PopulatedTemplateSection, 
  ReportTemplate, 
  ResearchDomain, 
  StructuredLearning 
} from './types';

/**
 * Identify the appropriate domain for the research
 */
export async function identifyResearchDomain(
  topic: string,
  learnings: StructuredLearning[]
): Promise<ResearchDomain> {
  // Extract a sample of learning titles and topics
  const sampleTitles = learnings
    .slice(0, Math.min(10, learnings.length))
    .map(l => l.title);
  
  const topics = new Set<string>();
  learnings.forEach(learning => {
    learning.topics.forEach(topic => topics.add(topic));
  });
  
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Identify the most appropriate domain category for this research topic and findings.

Research Topic: ${topic}

Sample Findings:
${sampleTitles.join('\n')}

Key Topics:
${Array.from(topics).join(', ')}

Categorize this research into ONE of the following domains:
- scientific: Research focused on natural sciences, physics, chemistry, biology, etc.
- medical: Research focused on healthcare, medicine, diseases, treatments, etc.
- business: Research focused on economics, finance, management, marketing, etc.
- historical: Research focused on past events, historical analysis, etc.
- technological: Research focused on technology, computing, engineering, etc.
- social: Research focused on sociology, psychology, education, etc.
- mixed: Research that significantly spans multiple domains above

Choose the SINGLE most appropriate domain based on the content.`,
    schema: z.object({
      domain: z.enum([
        'scientific', 
        'medical', 
        'business', 
        'historical', 
        'technological', 
        'social', 
        'mixed'
      ]).describe('The most appropriate domain for this research'),
      explanation: z.string().describe('Brief explanation for why this domain was selected'),
    }),
  });

  return res.object.domain;
}

/**
 * Get the template for a scientific research report
 */
function getScientificTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'scientific',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          purpose: 'Introduce the research topic, provide background information, and state the research objectives.',
          contentGuidelines: 'Include context, significance of the topic, and key research questions.',
        },
        {
          id: 'methodology',
          title: 'Methodology',
          purpose: 'Describe the research methods, data sources, and analytical approaches used.',
          contentGuidelines: 'Detail the research design, data collection methods, and analytical techniques.',
        },
        {
          id: 'results',
          title: 'Results',
          purpose: 'Present the key findings of the research without interpretation.',
          contentGuidelines: 'Organize findings logically, use tables and figures where appropriate, and highlight significant results.',
        },
        {
          id: 'discussion',
          title: 'Discussion',
          purpose: 'Interpret the results, compare with existing literature, and discuss implications.',
          contentGuidelines: 'Analyze the significance of findings, address limitations, and connect to broader scientific context.',
        },
        {
          id: 'conclusion',
          title: 'Conclusion',
          purpose: 'Summarize key findings, state conclusions, and suggest future research directions.',
          contentGuidelines: 'Provide clear takeaways, broader implications, and areas for further investigation.',
        },
      ],
    },
  };
}

/**
 * Get the template for a medical research report
 */
function getMedicalTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'medical',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          purpose: 'Introduce the medical topic, provide epidemiological context, and state the clinical relevance.',
          contentGuidelines: 'Include disease burden, current clinical approaches, and gaps in knowledge.',
        },
        {
          id: 'pathophysiology',
          title: 'Pathophysiology and Mechanisms',
          purpose: 'Explain the underlying biological mechanisms and pathophysiological processes.',
          contentGuidelines: 'Detail molecular pathways, physiological changes, and disease progression.',
        },
        {
          id: 'diagnosis',
          title: 'Diagnosis and Assessment',
          purpose: 'Describe diagnostic criteria, assessment tools, and clinical evaluation methods.',
          contentGuidelines: 'Include diagnostic tests, imaging techniques, and clinical markers.',
        },
        {
          id: 'treatment',
          title: 'Treatment Approaches',
          purpose: 'Review current and emerging treatment options, their efficacy, and limitations.',
          contentGuidelines: 'Cover pharmacological interventions, surgical approaches, and alternative therapies.',
        },
        {
          id: 'outcomes',
          title: 'Clinical Outcomes and Prognosis',
          purpose: 'Discuss treatment outcomes, prognostic factors, and quality of life considerations.',
          contentGuidelines: 'Include survival rates, complication risks, and long-term management strategies.',
        },
        {
          id: 'conclusion',
          title: 'Conclusion and Future Directions',
          purpose: 'Summarize key clinical insights and highlight areas for future research and practice improvement.',
          contentGuidelines: 'Provide practical implications for clinicians and researchers.',
        },
      ],
    },
  };
}

/**
 * Get the template for a business research report
 */
function getBusinessTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'business',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'executive_summary',
          title: 'Executive Summary',
          purpose: 'Provide a concise overview of the key findings, implications, and recommendations.',
          contentGuidelines: 'Summarize the most important insights and actionable takeaways.',
        },
        {
          id: 'market_analysis',
          title: 'Market Analysis',
          purpose: 'Analyze market trends, size, growth, and competitive landscape.',
          contentGuidelines: 'Include market segmentation, competitive positioning, and growth opportunities.',
        },
        {
          id: 'financial_analysis',
          title: 'Financial Analysis',
          purpose: 'Examine financial performance, metrics, and projections.',
          contentGuidelines: 'Cover revenue streams, cost structures, profitability, and investment considerations.',
        },
        {
          id: 'strategic_implications',
          title: 'Strategic Implications',
          purpose: 'Discuss strategic options, risks, and opportunities.',
          contentGuidelines: 'Analyze competitive advantages, strategic positioning, and future scenarios.',
        },
        {
          id: 'recommendations',
          title: 'Recommendations',
          purpose: 'Provide actionable recommendations based on the research findings.',
          contentGuidelines: 'Include specific, prioritized actions with expected outcomes and implementation considerations.',
        },
        {
          id: 'implementation',
          title: 'Implementation Roadmap',
          purpose: 'Outline steps for implementing the recommendations.',
          contentGuidelines: 'Include timeline, resource requirements, key milestones, and success metrics.',
        },
      ],
    },
  };
}

/**
 * Get the template for a technological research report
 */
function getTechnologicalTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'technological',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          purpose: 'Introduce the technology, its context, and significance.',
          contentGuidelines: 'Include historical context, current state, and importance of the technology.',
        },
        {
          id: 'technical_overview',
          title: 'Technical Overview',
          purpose: 'Explain the technical aspects, architecture, and functioning of the technology.',
          contentGuidelines: 'Include technical specifications, components, and operational principles.',
        },
        {
          id: 'applications',
          title: 'Applications and Use Cases',
          purpose: 'Describe current and potential applications of the technology.',
          contentGuidelines: 'Cover industry applications, use cases, and implementation examples.',
        },
        {
          id: 'challenges',
          title: 'Challenges and Limitations',
          purpose: 'Discuss technical challenges, limitations, and barriers to adoption.',
          contentGuidelines: 'Include technical constraints, scalability issues, and adoption barriers.',
        },
        {
          id: 'future_trends',
          title: 'Future Trends and Developments',
          purpose: 'Explore emerging trends, innovations, and future directions.',
          contentGuidelines: 'Cover research frontiers, upcoming innovations, and potential disruptions.',
        },
        {
          id: 'conclusion',
          title: 'Conclusion and Implications',
          purpose: 'Summarize key insights and discuss broader implications.',
          contentGuidelines: 'Include technological impact, societal implications, and strategic considerations.',
        },
      ],
    },
  };
}

/**
 * Get the template for a social research report
 */
function getSocialTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'social',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          purpose: 'Introduce the social phenomenon, context, and research questions.',
          contentGuidelines: 'Include social context, significance, and theoretical framework.',
        },
        {
          id: 'literature_review',
          title: 'Literature Review',
          purpose: 'Review existing research and theoretical perspectives on the topic.',
          contentGuidelines: 'Synthesize key studies, identify gaps, and position the current research.',
        },
        {
          id: 'findings',
          title: 'Key Findings',
          purpose: 'Present the main research findings organized by themes or questions.',
          contentGuidelines: 'Include evidence, examples, and patterns from the research.',
        },
        {
          id: 'analysis',
          title: 'Analysis and Interpretation',
          purpose: 'Analyze the findings in relation to theory and existing knowledge.',
          contentGuidelines: 'Discuss patterns, contradictions, and theoretical implications.',
        },
        {
          id: 'implications',
          title: 'Social Implications',
          purpose: 'Discuss the broader social, cultural, and policy implications.',
          contentGuidelines: 'Address impact on individuals, communities, institutions, and policy.',
        },
        {
          id: 'conclusion',
          title: 'Conclusion and Recommendations',
          purpose: 'Summarize key insights and provide recommendations for practice and research.',
          contentGuidelines: 'Include practical applications, policy recommendations, and future research directions.',
        },
      ],
    },
  };
}

/**
 * Get the template for a historical research report
 */
function getHistoricalTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'historical',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          purpose: 'Introduce the historical topic, period, and significance.',
          contentGuidelines: 'Include historical context, research questions, and historiographical positioning.',
        },
        {
          id: 'background',
          title: 'Historical Background',
          purpose: 'Provide essential background information and context.',
          contentGuidelines: 'Cover preceding events, conditions, and relevant historical developments.',
        },
        {
          id: 'analysis',
          title: 'Historical Analysis',
          purpose: 'Analyze key events, developments, and their significance.',
          contentGuidelines: 'Include chronological narrative, causal analysis, and interpretation of evidence.',
        },
        {
          id: 'perspectives',
          title: 'Multiple Perspectives',
          purpose: 'Present different historical interpretations and viewpoints.',
          contentGuidelines: 'Include competing narratives, historiographical debates, and diverse sources.',
        },
        {
          id: 'legacy',
          title: 'Legacy and Impact',
          purpose: 'Discuss the long-term impact and contemporary relevance.',
          contentGuidelines: 'Address historical consequences, modern implications, and collective memory.',
        },
        {
          id: 'conclusion',
          title: 'Conclusion',
          purpose: 'Summarize key historical insights and their significance.',
          contentGuidelines: 'Include historical lessons, unanswered questions, and areas for further research.',
        },
      ],
    },
  };
}

/**
 * Get the template for a mixed domain research report
 */
function getMixedTemplate(detailLevel: number): ReportTemplate {
  return {
    domain: 'mixed',
    detailLevel,
    structure: {
      sections: [
        {
          id: 'executive_summary',
          title: 'Executive Summary',
          purpose: 'Provide a concise overview of the key findings and implications.',
          contentGuidelines: 'Summarize the most important insights across all domains covered.',
        },
        {
          id: 'introduction',
          title: 'Introduction',
          purpose: 'Introduce the research topic, its multidisciplinary nature, and significance.',
          contentGuidelines: 'Include context, research questions, and the interdisciplinary approach.',
        },
        {
          id: 'domain_analysis',
          title: 'Multidisciplinary Analysis',
          purpose: 'Analyze the topic from multiple disciplinary perspectives.',
          contentGuidelines: 'Organize by relevant domains, highlighting interconnections and unique insights.',
        },
        {
          id: 'synthesis',
          title: 'Interdisciplinary Synthesis',
          purpose: 'Synthesize insights across domains to develop integrated understanding.',
          contentGuidelines: 'Identify patterns, contradictions, and emergent insights from cross-domain analysis.',
        },
        {
          id: 'implications',
          title: 'Implications and Applications',
          purpose: 'Discuss practical implications across different sectors and domains.',
          contentGuidelines: 'Address relevance to various stakeholders, fields, and practical applications.',
        },
        {
          id: 'future_directions',
          title: 'Future Directions',
          purpose: 'Suggest areas for future research and development.',
          contentGuidelines: 'Identify promising interdisciplinary approaches and knowledge gaps.',
        },
        {
          id: 'conclusion',
          title: 'Conclusion',
          purpose: 'Summarize key insights and the value of the interdisciplinary approach.',
          contentGuidelines: 'Emphasize unique contributions from the multidisciplinary perspective.',
        },
      ],
    },
  };
}

/**
 * Select or combine appropriate templates
 */
export function selectReportTemplate(
  domain: ResearchDomain,
  insightDetail: number
): ReportTemplate {
  switch (domain) {
    case 'scientific':
      return getScientificTemplate(insightDetail);
    case 'medical':
      return getMedicalTemplate(insightDetail);
    case 'business':
      return getBusinessTemplate(insightDetail);
    case 'technological':
      return getTechnologicalTemplate(insightDetail);
    case 'social':
      return getSocialTemplate(insightDetail);
    case 'historical':
      return getHistoricalTemplate(insightDetail);
    case 'mixed':
    default:
      return getMixedTemplate(insightDetail);
  }
}

/**
 * Map learnings to template sections
 */
export async function mapLearningsToTemplate(
  learnings: StructuredLearning[],
  template: ReportTemplate
): Promise<PopulatedTemplateSection[]> {
  const result: PopulatedTemplateSection[] = [];
  
  // Create a description of all template sections
  const sectionsDescription = template.structure.sections.map(section => 
    `  * ${section.id}: ${section.title} - ${section.purpose}`
  ).join('\n');
  
  // Process each learning to determine which sections it belongs to
  const learningMappings: Record<string, string[]> = {};
  
  for (const learning of learnings) {
    const res = await generateObject({
      model: getModel(),
      system: systemPrompt(),
      prompt: `Determine which sections of the report template this research learning belongs to. A learning can belong to multiple sections if relevant.

Report Template (${template.domain} domain):
${sectionsDescription}

Learning:
Title: ${learning.title}
Content: ${learning.content}
Topics: ${learning.topics.join(', ')}
Key Points: ${learning.keyPoints.join(', ')}

For each section where this learning belongs, provide the section ID and a brief explanation of why it fits there.`,
      schema: z.object({
        relevantSections: z.array(z.object({
          sectionId: z.string().describe('ID of the relevant section'),
          reason: z.string().describe('Brief explanation of why this learning belongs in this section'),
        })).describe('List of sections where this learning belongs'),
      }),
    });
    
    // Record the section IDs for this learning
    learningMappings[learning.id] = res.object.relevantSections.map(s => s.sectionId);
  }
  
  // Populate the template sections with learnings
  for (const section of template.structure.sections) {
    const sectionLearnings = learnings.filter(learning => 
      learningMappings[learning.id]?.includes(section.id)
    );
    
    result.push({
      section,
      learnings: sectionLearnings,
    });
  }
  
  return result;
}

/**
 * Generate content for each section following template guidelines
 */
export async function generateTemplateSections(
  populatedTemplate: PopulatedTemplateSection[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  
  for (const { section, learnings } of populatedTemplate) {
    // If no learnings for this section, generate placeholder content
    if (learnings.length === 0) {
      result[section.id] = `## ${section.title}\n\n*No specific research findings were available for this section.*`;
      continue;
    }
    
    // Prepare learning content
    const learningContent = learnings.map(learning => {
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
      prompt: `Write a section for a ${populatedTemplate[0].section.title} research report based on the following learnings. The section should follow the specific guidelines for this section type.

Section Title: ${section.title}
Section Purpose: ${section.purpose}
Content Guidelines: ${section.contentGuidelines}

Research Learnings:
${learningContent}

Guidelines:
1. Follow the specific purpose and content guidelines for this section type
2. Organize the content logically, covering all key aspects from the learnings
3. Include all important information from the learnings
4. Use proper citations for all factual statements (format: [Source])
5. Write in a professional, academic style appropriate for the domain
6. Include appropriate subheadings if needed
7. End with a brief summary of the section's key points

Format the section in Markdown, starting with a level 2 heading (##) for the section title.`,
      schema: z.object({
        sectionContent: z.string().describe(`The content for the "${section.title}" section`),
      }),
    });
    
    result[section.id] = res.object.sectionContent;
  }
  
  return result;
}

/**
 * Assemble the final report with appropriate transitions
 */
export function assembleTemplateReport(
  generatedSections: Record<string, string>,
  template: ReportTemplate
): string {
  // Create title and metadata
  let report = `# Research Report: ${template.domain.charAt(0).toUpperCase() + template.domain.slice(1)} Domain\n\n`;
  
  // Add table of contents
  report += `## Table of Contents\n\n`;
  
  template.structure.sections.forEach((section, index) => {
    report += `${index + 1}. ${section.title}\n`;
  });
  
  report += `\n---\n\n`;
  
  // Add section contents in the order specified by the template
  for (const section of template.structure.sections) {
    report += `${generatedSections[section.id] || `## ${section.title}\n\n*No content available for this section.*`}\n\n`;
  }
  
  // Add footer
  report += `\n\n---\n\n*This report follows a structured template for ${template.domain} domain research, ensuring comprehensive coverage of all relevant aspects.*\n\n`;
  
  return report;
}

/**
 * Generate a report using a template-based approach
 */
export async function templateBasedReportGeneration(
  topic: string,
  structuredLearnings: StructuredLearning[],
  insightDetail: number,
  visitedUrls: string[],
  pubMedArticles: PubMedArticle[]
): Promise<string> {
  // 1. Identify appropriate domain-specific templates
  const domainType = await identifyResearchDomain(topic, structuredLearnings);
  
  // 2. Select or combine appropriate templates
  const reportTemplate = selectReportTemplate(domainType, insightDetail);
  
  // 3. Map learnings to template sections
  const populatedTemplate = await mapLearningsToTemplate(structuredLearnings, reportTemplate);
  
  // 4. Generate section content following template guidelines
  const generatedSections = await generateTemplateSections(populatedTemplate);
  
  // 5. Assemble final report with appropriate transitions
  let report = assembleTemplateReport(generatedSections, reportTemplate);
  
  // 6. Add references section
  let referencesSection = `\n\n## References\n\n`;
  
  // Add web sources
  if (visitedUrls.length > 0) {
    referencesSection += `### Web Sources\n\n`;
    referencesSection += visitedUrls.map((url, index) => {
      return `[web${index + 1}] ${url}`;
    }).join('\n\n');
  }
  
  // Add PubMed citations if available
  if (pubMedArticles.length > 0) {
    referencesSection += '\n\n### PubMed Citations\n\n';
    referencesSection += pubMedArticles.map((article, index) => {
      return `[pubmed${index + 1}] ${article.authors?.join(', ') || '[No authors listed]'}. ${article.title}. ${article.journal || '[Journal not specified]'}. ${article.publicationDate || '[Date not specified]'}. ${article.doi ? `doi: ${article.doi}` : ''}\n   [PubMed Link](${article.url})`;
    }).join('\n\n');
  }
  
  report += referencesSection;
  
  return report;
}
