import cors from 'cors';
import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

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
app.get('/api/export/:format/:id', (req: Request, res: Response) => {
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
    switch (format) {
      case 'markdown':
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="research-${id}.md"`);
        return res.send(report);

      case 'pdf':
        // For now, just return the markdown as we don't have PDF generation yet
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="research-${id}.md"`);
        return res.send(report);

      case 'word':
        // For now, just return the markdown as we don't have Word generation yet
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="research-${id}.md"`);
        return res.send(report);

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
