import * as fs from 'fs/promises';
import * as readline from 'readline';

import { getModel } from './ai/providers';
import {
  deepResearch,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { generateFeedback } from './feedback';
import { MeshRestrictiveness } from './pubmed';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

// run the agent
async function run() {
  console.log('Using model: ', getModel().modelId);

  // Get initial query
  const initialQuery = await askQuestion('What would you like to research? ');

  // Get breath and depth parameters
  const breadth =
    parseInt(
      await askQuestion(
        'Enter research breadth (recommended 2-10, default 4): ',
      ),
      10,
    ) || 4;
  const depth =
    parseInt(
      await askQuestion('Enter research depth (recommended 1-5, default 2): '),
      10,
    ) || 2;
  const isReport =
    (await askQuestion(
      'Do you want to generate a long report or a specific answer? (report/answer, default report): ',
    )) !== 'answer';

  // Ask about MeSH term restrictiveness if PubMed search is enabled
  let meshRestrictiveness = process.env.MESH_RESTRICTIVENESS as MeshRestrictiveness || MeshRestrictiveness.MEDIUM;
  if (process.env.INCLUDE_PUBMED_SEARCH === 'true' && process.env.USE_MESH_TERMS === 'true') {
    const restrictiveness = await askQuestion(
      'Select PubMed MeSH term restrictiveness (low/medium/high, default medium):\n' +
      '- low: Broader search with more results\n' +
      '- medium: Balanced approach\n' +
      '- high: Narrower search with more specific results\n' +
      'Your choice: '
    );

    if (restrictiveness.toLowerCase() === 'low') {
      meshRestrictiveness = MeshRestrictiveness.LOW;
    } else if (restrictiveness.toLowerCase() === 'high') {
      meshRestrictiveness = MeshRestrictiveness.HIGH;
    } else {
      meshRestrictiveness = MeshRestrictiveness.MEDIUM;
    }

    log(`Using ${meshRestrictiveness} restrictiveness for MeSH terms.`);
  }

  let combinedQuery = initialQuery;
  if (isReport) {
    log(`Creating research plan...`);

    // Generate follow-up questions
    const followUpQuestions = await generateFeedback({
      query: initialQuery,
    });

    log(
      '\nTo better understand your research needs, please answer these follow-up questions:',
    );

    // Collect answers to follow-up questions
    const answers: string[] = [];
    for (const question of followUpQuestions) {
      const answer = await askQuestion(`\n${question}\nYour answer: `);
      answers.push(answer);
    }

    // Combine all information for deep research
    combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${followUpQuestions.map((q: string, i: number) => `Q: ${q}\nA: ${answers[i]}`).join('\n')}
`;
  }

  log('\nStarting research...\n');

  const { learnings, visitedUrls, pubMedArticles } = await deepResearch({
    query: combinedQuery,
    breadth,
    depth,
    meshRestrictiveness,
  });

  log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
  log(`\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`);

  if (pubMedArticles && pubMedArticles.length > 0) {
    log(`\n\nPubMed Articles (${pubMedArticles.length}):\n\n${pubMedArticles.map(a => a.title).join('\n')}`);
  }

  log('Writing final report...');

  if (isReport) {
    const report = await writeFinalReport({
      prompt: combinedQuery,
      learnings,
      visitedUrls,
      pubMedArticles,
    });

    await fs.writeFile('report.md', report, 'utf-8');
    console.log(`\n\nFinal Report:\n\n${report}`);
    console.log('\nReport has been saved to report.md');
  } else {
    const answer = await writeFinalAnswer({
      prompt: combinedQuery,
      learnings,
    });

    await fs.writeFile('answer.md', answer, 'utf-8');
    console.log(`\n\nFinal Answer:\n\n${answer}`);
    console.log('\nAnswer has been saved to answer.md');
  }

  rl.close();
}

run().catch(console.error);
