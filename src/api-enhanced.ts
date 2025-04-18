import cors from 'cors';
import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it';
import HTMLtoDOCX from 'html-to-docx';

import { deepResearch, writeFinalAnswer, writeFinalReport } from './deep-research';
import { MeshRestrictiveness } from './pubmed';
import { generateFeedback } from './feedback';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());

// Store active research sessions
interface ResearchSession {
  id: string;
  query: string;
  breadth: number;
  depth: number;
  meshRestrictiveness: MeshRestrictiveness;
  outputType: 'report' | 'answer';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: {
    stage: 'initializing' | 'generating-queries' | 'searching-web' | 'searching-pubmed' | 'processing-results' | 'generating-report' | 'complete';
    percentage: number;
    currentQuery?: string;
    sources: string[];
  };
  results?: {
    report?: string;
    answer?: string;
    learnings: string[];
    visitedUrls: string[];
    pubMedArticles?: any[];
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessions: Record<string, ResearchSession> = {};

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// API endpoint to generate follow-up questions
app.post('/api/questions/generate', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const questions = await generateFeedback({
      query,
      numQuestions: 3,
    });

    return res.json({ questions });
  } catch (error: unknown) {
    console.error('Error generating questions:', error);
    return res.status(500).json({
      error: 'An error occurred while generating questions',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// API endpoint to start research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const {
      query,
      depth = 2,
      breadth = 4,
      meshRestrictiveness = 'medium',
      outputType = 'report',
      combinedQuery = ''
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Convert meshRestrictiveness string to enum
    let meshRestrictivenessEnum = MeshRestrictiveness.MEDIUM;
    if (meshRestrictiveness === 'low') {
      meshRestrictivenessEnum = MeshRestrictiveness.LOW;
    } else if (meshRestrictiveness === 'high') {
      meshRestrictivenessEnum = MeshRestrictiveness.HIGH;
    }

    // Create a new research session
    const researchId = uuidv4();
    const session: ResearchSession = {
      id: researchId,
      query,
      breadth,
      depth,
      meshRestrictiveness: meshRestrictivenessEnum,
      outputType,
      status: 'pending',
      progress: {
        stage: 'initializing',
        percentage: 0,
        sources: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    sessions[researchId] = session;

    // Start the research process in the background
    setTimeout(async () => {
      try {
        session.status = 'in-progress';
        session.progress.stage = 'generating-queries';
        session.progress.percentage = 10;
        session.updatedAt = new Date();

        const finalQuery = combinedQuery || query;

        // Create a temporary array to store sources during the research process
        const tempSources: string[] = [];

        // Add a sample source every 5 seconds to simulate progress
        const sourcesInterval = setInterval(() => {
          if (session.progress.stage === 'searching-web' || session.progress.stage === 'searching-pubmed') {
            const newSource = `https://example.com/source-${tempSources.length + 1}`;
            tempSources.push(newSource);
            session.progress.sources = [...tempSources];
            session.updatedAt = new Date();
          }
        }, 5000);

        // Run the research
        const { learnings, visitedUrls, pubMedArticles } = await deepResearch({
          query: finalQuery,
          breadth,
          depth,
          meshRestrictiveness: meshRestrictivenessEnum,
          onProgress: (progress) => {
            // Update progress based on the current stage
            if (progress.currentDepth === depth) {
              session.progress.stage = 'generating-queries';
              session.progress.percentage = 10 + (90 * (progress.completedQueries / progress.totalQueries) * 0.1);
            } else if (progress.currentDepth > 0) {
              session.progress.stage = 'searching-web';
              session.progress.percentage = 20 + (90 * (progress.completedQueries / progress.totalQueries) * 0.4);
            } else {
              session.progress.stage = 'searching-pubmed';
              session.progress.percentage = 60 + (90 * (progress.completedQueries / progress.totalQueries) * 0.2);
            }

            if (progress.currentQuery) {
              session.progress.currentQuery = progress.currentQuery;
            }

            session.updatedAt = new Date();
          }
        });

        // Clear the interval when research is complete
        clearInterval(sourcesInterval);

        // Update sources with real visited URLs
        session.progress.sources = [...visitedUrls];

        // Generate the final output
        session.progress.stage = 'generating-report';
        session.progress.percentage = 80;
        session.updatedAt = new Date();

        let report = '';
        let answer = '';

        if (outputType === 'report') {
          report = await writeFinalReport({
            prompt: query,
            learnings,
            visitedUrls,
            pubMedArticles
          });
        } else {
          answer = await writeFinalAnswer({
            prompt: query,
            learnings
          });
        }

        // Update the session with the results
        session.status = 'completed';
        session.progress.stage = 'complete';
        session.progress.percentage = 100;
        session.results = {
          report,
          answer,
          learnings,
          visitedUrls,
          pubMedArticles
        };
        session.updatedAt = new Date();
      } catch (error: unknown) {
        console.error('Error in background research process:', error);
        session.status = 'failed';
        session.error = error instanceof Error ? error.message : String(error);
        session.updatedAt = new Date();
      }
    }, 0);

    // Return the research ID immediately
    return res.json({ researchId });
  } catch (error: unknown) {
    console.error('Error starting research:', error);
    return res.status(500).json({
      error: 'An error occurred while starting research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// API endpoint for progress tracking (Server-Sent Events)
app.get('/api/research/progress/:id', (req: Request, res: Response) => {
  const researchId = req.params.id;
  const session = sessions[researchId];

  if (!session) {
    return res.status(404).json({ error: 'Research session not found' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send the initial progress
  const sendProgress = () => {
    res.write(`data: ${JSON.stringify(session.progress)}\n\n`);
  };

  // Send progress updates every second
  sendProgress();
  const intervalId = setInterval(sendProgress, 1000);

  // Clean up when the client disconnects
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

// API endpoint to get research results
app.get('/api/research/:id', (req: Request, res: Response) => {
  const researchId = req.params.id;
  const session = sessions[researchId];

  if (!session) {
    return res.status(404).json({ error: 'Research session not found' });
  }

  if (session.status === 'failed') {
    return res.status(500).json({
      error: 'Research failed',
      message: session.error
    });
  }

  if (session.status !== 'completed') {
    return res.status(202).json({
      status: session.status,
      progress: session.progress
    });
  }

  return res.json({
    report: session.results?.report || '',
    answer: session.results?.answer || '',
    learnings: session.results?.learnings || [],
    visitedUrls: session.results?.visitedUrls || [],
    pubMedArticles: session.results?.pubMedArticles || []
  });
});

// API endpoint to export research results
app.get('/api/export/:format/:id', async (req: Request, res: Response) => {
  const { format, id } = req.params;
  const session = sessions[id];

  if (!session) {
    return res.status(404).json({ error: 'Research session not found' });
  }

  if (session.status !== 'completed' || !session.results) {
    return res.status(202).json({
      status: session.status,
      message: 'Research is not yet completed'
    });
  }

  const report = session.results.report || session.results.answer || '';

  if (!report) {
    return res.status(404).json({ error: 'No report found' });
  }

  try {
    // Initialize markdown parser
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });

    // Convert markdown to HTML
    const htmlContent = md.render(report);

    // Create a complete HTML document with proper styling
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Research Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #2c3e50;
            font-size: 28px;
            margin-top: 40px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
          }
          h2 {
            color: #3498db;
            font-size: 22px;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          h3 {
            color: #2980b9;
            font-size: 18px;
            margin-top: 20px;
            margin-bottom: 10px;
          }
          p {
            margin-bottom: 15px;
            line-height: 1.6;
          }
          a {
            color: #3498db;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          ul, ol {
            margin-bottom: 20px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 8px;
          }
          blockquote {
            border-left: 4px solid #ccc;
            padding-left: 15px;
            color: #666;
            margin: 15px 0;
          }
          code {
            background-color: #f8f8f8;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
          }
          pre {
            background-color: #f8f8f8;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
          img {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    switch (format) {
      case 'markdown':
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="research-${id}.md"`);
        return res.send(report);

      case 'pdf':
        try {
          // Launch a headless browser
          const browser = await puppeteer.launch({ headless: 'new' });
          const page = await browser.newPage();

          // Set the HTML content
          await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

          // Generate PDF
          const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div style="font-size: 8px; margin-left: 20px;">Research Report</div>',
            footerTemplate: '<div style="font-size: 8px; margin-left: 20px; width: 100%; text-align: center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
            preferCSSPageSize: true
          });

          // Close the browser
          await browser.close();

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="research-${id}.pdf"`);
          return res.send(pdfBuffer);
        } catch (pdfError) {
          console.error('Error generating PDF:', pdfError);
          // Fallback to markdown if PDF generation fails
          res.setHeader('Content-Type', 'text/markdown');
          res.setHeader('Content-Disposition', `attachment; filename="research-${id}.md"`);
          return res.send(report);
        }

      case 'word':
        try {
          // Generate DOCX from HTML
          const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
            title: 'Research Report',
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true
          });

          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          res.setHeader('Content-Disposition', `attachment; filename="research-${id}.docx"`);
          return res.send(docxBuffer);
        } catch (wordError) {
          console.error('Error generating Word document:', wordError);
          // Fallback to markdown if Word generation fails
          res.setHeader('Content-Type', 'text/markdown');
          res.setHeader('Content-Disposition', `attachment; filename="research-${id}.md"`);
          return res.send(report);
        }

      default:
        return res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Error exporting research:', error);
    return res.status(500).json({
      error: 'An error occurred while exporting research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Enhanced Deep Research API running on port ${port}`);
});

export default app;
