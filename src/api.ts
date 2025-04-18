import cors from 'cors';
import express, { Request, Response } from 'express';

import { deepResearch, writeFinalAnswer } from './deep-research';
import { MeshRestrictiveness } from './pubmed';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3, meshRestrictiveness = 'medium' } = req.body;

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

    log('\nStarting research...\n');

    const { learnings, visitedUrls, pubMedArticles } = await deepResearch({
      query,
      breadth,
      depth,
      meshRestrictiveness: meshRestrictivenessEnum,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    if (pubMedArticles && pubMedArticles.length > 0) {
      log(`\n\nPubMed Articles (${pubMedArticles.length}):\n\n${pubMedArticles.map(a => a.title).join('\n')}`);
    }

    const answer = await writeFinalAnswer({
      prompt: query,
      learnings,
    });

    // Return the results
    return res.json({
      success: true,
      answer,
      learnings,
      visitedUrls,
      pubMedArticles,
    });
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
