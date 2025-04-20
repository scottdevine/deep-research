import { PubMedArticle } from './pubmed';

export interface StructuredLearning {
  id: string;
  title: string;
  content: string;
  sources: string[];
  keyPoints: string[];
  importance: number; // 1-10 scale
  topics: string[];
  metadata: {
    depth: number;
    confidenceScore: number;
    contentType: 'factual' | 'analytical' | 'conceptual';
  };
}

export interface LayeredLearning extends StructuredLearning {
  summaries: {
    brief: string; // 1-2 sentences
    moderate: string; // paragraph
    detailed: string; // full content
  };
}

export interface TopicNode {
  id: string;
  topic: string;
  subtopics: TopicNode[];
  learnings: StructuredLearning[];
  summary?: string;
}

export interface TopicSummary {
  topic: string;
  summary: string;
  relatedLearnings: string[]; // IDs of related learnings
}

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  subsections?: ReportSection[];
}

export interface ReportOutline {
  title: string;
  sections: ReportSection[];
}

export interface ResearchResult {
  learnings: StructuredLearning[];
  visitedUrls: string[];
  pubMedArticles: PubMedArticle[];
  hierarchicalLearnings?: TopicNode[];
  layeredLearnings?: LayeredLearning[];
  topicSummaries?: TopicSummary[];
  keyInsights?: string[];
}

export type ResearchDomain = 
  | 'scientific'
  | 'medical'
  | 'business'
  | 'historical'
  | 'technological'
  | 'social'
  | 'mixed';

export interface ReportTemplate {
  domain: ResearchDomain;
  detailLevel: number;
  structure: {
    sections: {
      id: string;
      title: string;
      purpose: string;
      contentGuidelines: string;
    }[];
  };
}

export interface PopulatedTemplateSection {
  section: ReportTemplate['structure']['sections'][0];
  learnings: StructuredLearning[];
}
