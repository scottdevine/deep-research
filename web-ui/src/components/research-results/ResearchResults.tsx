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
  researchId?: string;
  onNewSearch: () => void;
}

export default function ResearchResults({ results, researchId, onNewSearch }: ResearchResultsProps) {
  const [activeSection, setActiveSection] = useState<number | null>(null);

  const toggleSection = (section: number) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportReport = async (format: 'pdf' | 'markdown' | 'word') => {
    setIsExporting(true);
    setExportError(null);

    try {
      if (!researchId) {
        // If no research ID provided, create a temporary file with the report content
        const blob = new Blob([results.report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `research-report.${format === 'markdown' ? 'md' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        return;
      }

      // Call the API to generate the export
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051';
      const response = await fetch(`${apiUrl}/api/export/${format}/${researchId}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-${researchId}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error exporting as ${format}:`, error);
      setExportError(`Failed to export as ${format}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
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
            disabled={isExporting}
            className={`px-3 py-1 text-sm ${isExporting ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'} rounded-md flex items-center`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : 'Export as PDF'}
          </button>
          <button
            onClick={() => exportReport('markdown')}
            disabled={isExporting}
            className={`px-3 py-1 text-sm ${isExporting ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'} rounded-md`}
          >
            Export as Markdown
          </button>
          <button
            onClick={() => exportReport('word')}
            disabled={isExporting}
            className={`px-3 py-1 text-sm ${isExporting ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'} rounded-md`}
          >
            Export as Word
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {exportError}
        </div>
      )}

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
