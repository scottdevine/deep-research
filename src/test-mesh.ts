import { convertToMeshTerms, searchPubMed } from './pubmed';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

async function testMeshConversion() {
  log('Testing MeSH term conversion...');
  
  if (!process.env.PUBMED_API_KEY) {
    log('Error: PUBMED_API_KEY not found in environment variables.');
    log('Please set PUBMED_API_KEY in your .env.local file.');
    return;
  }
  
  if (process.env.USE_MESH_TERMS !== 'true') {
    log('Warning: USE_MESH_TERMS is not set to true in environment variables.');
    log('Setting it to true for this test.');
  }
  
  try {
    // Test a few medical queries
    const queries = [
      'recent advances in cancer immunotherapy for solid tumors',
      'effectiveness of SGLT2 inhibitors in heart failure patients',
      'COVID-19 vaccine efficacy against new variants'
    ];
    
    for (const query of queries) {
      log(`\n--- Testing query: "${query}" ---`);
      
      // Convert to MeSH terms
      const meshQuery = await convertToMeshTerms(query);
      log(`Converted to MeSH query: ${meshQuery}`);
      
      // Search with original query
      log('\nSearching with original query...');
      const regularResults = await searchPubMed(query, 3, false);
      log(`Found ${regularResults.total} total results, displaying ${regularResults.articles.length} articles.`);
      
      // Search with MeSH query
      log('\nSearching with MeSH query...');
      const meshResults = await searchPubMed(query, 3, true);
      log(`Found ${meshResults.total} total results, displaying ${meshResults.articles.length} articles.`);
      
      // Compare results
      if (meshResults.total !== regularResults.total) {
        log(`\nDifference in results: MeSH query found ${meshResults.total} results vs. ${regularResults.total} for regular query.`);
      }
      
      // Display MeSH results
      if (meshResults.articles.length > 0) {
        log('\nTop result from MeSH query:');
        log(`Title: ${meshResults.articles[0].title}`);
        log(`Journal: ${meshResults.articles[0].journal || 'Not specified'}`);
        log(`URL: ${meshResults.articles[0].url}`);
      }
    }
    
    log('\nMeSH term conversion test completed successfully!');
  } catch (error) {
    log('Error testing MeSH term conversion:', error);
  }
}

// Run the test
testMeshConversion().catch(console.error);
