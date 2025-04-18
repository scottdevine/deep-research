'use client';

import { useState } from 'react';
import ResearchForm, { FormData } from '@/components/research-form/ResearchForm';
import ProgressTracker from '@/components/progress-tracker/ProgressTracker';
import ResearchResults, { ResearchResult } from '@/components/research-results/ResearchResults';

// Sample research result for demonstration
const sampleResult: ResearchResult = {
  report: `# Research Report: Latest Treatments for Rheumatoid Arthritis

## Introduction
Rheumatoid arthritis (RA) is a chronic inflammatory disorder that affects the joints and can damage a wide variety of body systems. This report examines the latest treatments available for RA, including both approved medications and promising clinical trials.

## Conventional DMARDs
Disease-modifying antirheumatic drugs (DMARDs) remain the foundation of RA treatment. Methotrexate continues to be the first-line therapy for most patients, often in combination with other treatments.

## Biologic DMARDs
Biologic DMARDs have revolutionized RA treatment. TNF inhibitors like adalimumab, etanercept, and infliximab are well-established options. Newer biologics targeting different pathways include:
- IL-6 inhibitors (tocilizumab, sarilumab)
- T-cell costimulation modulator (abatacept)
- B-cell depleting therapy (rituximab)
- IL-1 receptor antagonist (anakinra)

## JAK Inhibitors
Janus kinase (JAK) inhibitors represent a newer class of oral medications:
- Tofacitinib (Xeljanz)
- Baricitinib (Olumiant)
- Upadacitinib (Rinvoq)
- Filgotinib (Jyseleca)

## Emerging Therapies
Several promising treatments are in clinical trials:
- BTK inhibitors
- Dual JAK/TYK2 inhibitors
- Novel IL-6 inhibitors
- Targeted synthetic DMARDs

## Non-Pharmacological Approaches
Complementary approaches include:
- Physical and occupational therapy
- Exercise programs
- Dietary modifications
- Mind-body interventions

## Conclusion
The treatment landscape for RA continues to evolve, with an increasing focus on personalized medicine approaches based on individual patient characteristics and biomarkers.`,
  learnings: [
    "JAK inhibitors represent a newer class of oral medications for RA, including tofacitinib, baricitinib, upadacitinib, and filgotinib.",
    "Biologic DMARDs targeting different pathways include TNF inhibitors, IL-6 inhibitors, T-cell costimulation modulators, and B-cell depleting therapies.",
    "Emerging therapies in clinical trials include BTK inhibitors, dual JAK/TYK2 inhibitors, and novel IL-6 inhibitors.",
    "Non-pharmacological approaches like physical therapy, exercise, dietary modifications, and mind-body interventions play an important complementary role."
  ],
  visitedUrls: [
    "https://www.rheumatology.org/Portals/0/Files/ACR-2020-Guideline-Treatment-Rheumatoid-Arthritis.pdf",
    "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7982740/",
    "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(21)00578-4/fulltext",
    "https://arthritis-research.biomedcentral.com/articles/10.1186/s13075-020-02288-8",
    "https://www.nejm.org/doi/full/10.1056/NEJMra2032042"
  ],
  pubMedArticles: [
    {
      id: "34528743",
      title: "JAK inhibitors: A new era in the treatment of rheumatoid arthritis",
      authors: ["Smith J", "Johnson A", "Williams B"],
      journal: "Nature Reviews Rheumatology",
      publicationDate: "2023 Mar 15",
      doi: "10.1038/s41584-023-00945-1",
      url: "https://pubmed.ncbi.nlm.nih.gov/34528743/"
    },
    {
      id: "35762109",
      title: "Emerging therapies for rheumatoid arthritis: focus on BTK inhibitors",
      authors: ["Chen Y", "Davis R", "Thompson K"],
      journal: "Arthritis Research & Therapy",
      publicationDate: "2023 Jun 22",
      doi: "10.1186/s13075-023-02981-4",
      url: "https://pubmed.ncbi.nlm.nih.gov/35762109/"
    },
    {
      id: "36124587",
      title: "Non-pharmacological interventions in rheumatoid arthritis: A systematic review and meta-analysis",
      authors: ["Brown M", "Garcia P", "Wilson T"],
      journal: "BMJ Open",
      publicationDate: "2023 Feb 10",
      doi: "10.1136/bmjopen-2022-067891",
      url: "https://pubmed.ncbi.nlm.nih.gov/36124587/"
    }
  ]
};

export default function Home() {
  const [step, setStep] = useState<'form' | 'progress' | 'results'>('form');
  const [researchId, setResearchId] = useState<string>('');
  const [results, setResults] = useState<ResearchResult | null>(null);
  
  const handleFormSubmit = (formData: FormData) => {
    console.log('Form submitted:', formData);
    // In a real implementation, we would call an API to start the research
    // For now, we'll just generate a random research ID
    setResearchId(`research-${Math.random().toString(36).substring(2, 11)}`);
    setStep('progress');
  };
  
  const handleProgressComplete = () => {
    // In a real implementation, we would fetch the results from the API
    // For now, we'll just use the sample result
    setResults(sampleResult);
    setStep('results');
  };
  
  const handleNewSearch = () => {
    setStep('form');
    setResearchId('');
    setResults(null);
  };
  
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Deep Research Tool</h1>
          <p className="mt-2 text-lg text-gray-600">
            Explore topics in depth with AI-powered research
          </p>
        </div>
        
        {step === 'form' && (
          <ResearchForm onSubmit={handleFormSubmit} />
        )}
        
        {step === 'progress' && researchId && (
          <ProgressTracker 
            researchId={researchId} 
            onComplete={handleProgressComplete} 
          />
        )}
        
        {step === 'results' && results && (
          <ResearchResults 
            results={results} 
            onNewSearch={handleNewSearch} 
          />
        )}
      </div>
    </main>
  );
}
