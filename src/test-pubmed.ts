import { searchPubMed, pubMedResultToMarkdown } from './pubmed';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

async function testPubMed() {
  log('Testing PubMed integration...');
  
  if (!process.env.PUBMED_API_KEY) {
    log('Error: PUBMED_API_KEY not found in environment variables.');
    log('Please set PUBMED_API_KEY in your .env.local file.');
    return;
  }
  
  try {
    // Test a medical query
    const query = 'recent advances in COVID-19 treatment';
    log(`Searching PubMed for: "${query}"`);
    
    const results = await searchPubMed(query, 3);
    
    log(`Found ${results.total} total results, displaying ${results.articles.length} articles:`);
    
    if (results.articles.length === 0) {
      log('No articles found. Please check your API key and try again.');
      return;
    }
    
    // Display each article
    results.articles.forEach((article, index) => {
      log(`\n--- Article ${index + 1} ---`);
      log(`Title: ${article.title}`);
      log(`Authors: ${article.authors?.join(', ') || 'None listed'}`);
      log(`Journal: ${article.journal || 'Not specified'}`);
      log(`Date: ${article.publicationDate || 'Not specified'}`);
      log(`URL: ${article.url}`);
      
      // Display the markdown version
      log('\nMarkdown format:');
      log(pubMedResultToMarkdown(article));
    });
    
    log('\nPubMed integration test completed successfully!');
  } catch (error) {
    log('Error testing PubMed integration:', error);
  }
}

// Run the test
testPubMed().catch(console.error);
