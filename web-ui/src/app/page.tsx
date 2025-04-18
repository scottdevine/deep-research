'use client';

import { useState } from 'react';
import ResearchForm from '../components/research-form/ResearchForm';
import ProgressTracker from '../components/progress-tracker/ProgressTracker';
import ResearchResults, { ResearchResult } from '../components/research-results/ResearchResults';

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
- Filgotinib (Jyseleca)`,
  learnings: [
    "JAK inhibitors represent a newer class of oral medications for RA, including tofacitinib, baricitinib, upadacitinib, and filgotinib.",
    "Biologic DMARDs targeting different pathways include TNF inhibitors, IL-6 inhibitors, T-cell costimulation modulators, and B-cell depleting therapies."
  ],
  visitedUrls: [
    "https://www.rheumatology.org/Portals/0/Files/ACR-2020-Guideline-Treatment-Rheumatoid-Arthritis.pdf",
    "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7982740/"
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
    }
  ]
};

export default function Home() {
  const [step, setStep] = useState<'form' | 'progress' | 'results'>('form');
  const [researchId, setResearchId] = useState<string>('');
  const [results, setResults] = useState<ResearchResult | null>(null);

  const handleFormSubmit = (formData: any) => {
    console.log('Form submitted:', formData);
    // Generate a random research ID
    setResearchId(`research-${Math.random().toString(36).substring(2, 11)}`);
    setStep('progress');
  };

  const handleProgressComplete = () => {
    // Set the sample results
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