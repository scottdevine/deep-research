'use client';

import { useState } from 'react';

export type PubMedArticle = {
  id: string;
  title: string;
  abstract?: string;
  authors?: string[];
  journal?: string;
  publicationDate?: string;
  doi?: string;
  url: string;
};

export type ResearchResult = {
  report: string;
  learnings: string[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
};

interface ResearchResultsProps {
  results: ResearchResult;
  onNewSearch: () => void;
}

export default function ResearchResults({ results, onNewSearch }: ResearchResultsProps) {
  const [activeSection, setActiveSection] = useState<number | null>(null);
  
  const toggleSection = (section: number) => {
    setActiveSection(activeSection === section ? null : section);
  };
  
  const exportReport = (format: 'pdf' | 'markdown' | 'word') => {
    // In a real implementation, we would call an API to generate the export
    alert(`Exporting in ${format} format`);
  };
  
  // Extract sections from the markdown report
  // This is a simplified version - in a real implementation, we would use a markdown parser
  const sections = results.report.split('## ').filter(Boolean).map(section => {
    const lines = section.split('\n');
    const title = lines[0];
    const content = lines.slice(1).join('\n');
    return { title, content };
  });
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Research Results</h1>
        <div className="space-x-2">
          <button 
            onClick={() => exportReport('pdf')}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Export as PDF
          </button>
          <button 
            onClick={() => exportReport('markdown')}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Export as Markdown
          </button>
          <button 
            onClick={() => exportReport('word')}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Export as Word
          </button>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Report</h2>
        
        <div className="border rounded-lg overflow-hidden">
          {sections.map((section, index) => (
            <div key={index} className="border-b last:border-b-0">
              <button
                className="w-full text-left p-4 font-semibold flex justify-between items-center hover:bg-gray-50"
                onClick={() => toggleSection(index)}
              >
                {section.title}
                <span>{activeSection === index ? '−' : '+'}</span>
              </button>
              
              {activeSection === index && (
                <div className="p-4 prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: section.content }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">Sources</h2>
          <div className="border rounded-md overflow-hidden">
            <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
              {results.visitedUrls.map((url, index) => (
                <li key={index} className="p-3 hover:bg-gray-50">
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {results.pubMedArticles && results.pubMedArticles.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">PubMed Citations</h2>
            <div className="border rounded-md overflow-hidden">
              <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {results.pubMedArticles.map((article, index) => (
                  <li key={index} className="p-3 hover:bg-gray-50">
                    <h3 className="font-medium text-gray-900">{article.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {article.authors?.join(', ') || 'No authors listed'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {article.journal || 'Journal not specified'}, {article.publicationDate || 'Date not specified'}
                    </p>
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View on PubMed
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 text-center">
        <button
          onClick={onNewSearch}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Start New Research
        </button>
      </div>
    </div>
  );
}
