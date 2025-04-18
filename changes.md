# PubMed Integration Changes

## Overview

This document outlines the changes made to integrate PubMed API functionality into the Deep Research tool. The integration allows the tool to search for academic and medical research papers from PubMed alongside web search results from Firecrawl.

## Implementation Details

### 1. New Files

- **src/pubmed.ts**: Created a new module to handle PubMed API interactions, including:
  - Functions to search PubMed using their API
  - Types and schemas for PubMed article data
  - Formatting functions for citations based on different citation styles
  - Conversion of PubMed results to markdown format

### 2. Modified Files

- **src/deep-research.ts**: Updated to incorporate PubMed search alongside Firecrawl search
  - Added PubMedArticle type to ResearchResult interface
  - Modified processSerpResult to include PubMed articles in content processing
  - Updated deepResearch function to perform PubMed searches when enabled
  - Enhanced writeFinalReport to include PubMed citations in the report
  - Added deduplication for PubMed articles

- **src/run.ts**: Updated to handle PubMed articles in the CLI interface
  - Modified to display PubMed article titles in the console output
  - Updated writeFinalReport call to include PubMed articles

- **src/api.ts**: Updated to include PubMed articles in the API response
  - Modified to display PubMed article titles in the logs
  - Updated API response to include PubMed articles

### 3. Configuration

The PubMed integration uses the following environment variables in `.env.local`:

```
# PubMed API settings
PUBMED_API_KEY="your_pubmed_api_key"
INCLUDE_PUBMED_SEARCH=true

# Citation format
CITATION_STYLE="NLM" # or "mla", "chicago", etc.
```

- **PUBMED_API_KEY**: Your PubMed API key from NCBI
- **INCLUDE_PUBMED_SEARCH**: Set to "true" to enable PubMed search, "false" to disable
- **CITATION_STYLE**: Citation style for PubMed articles (NLM, mla, chicago)

## Usage

The PubMed integration works automatically when enabled. When a research query is processed:

1. The system searches both web content (via Firecrawl) and academic papers (via PubMed)
2. PubMed results are processed alongside web content to generate learnings
3. The final report includes a dedicated "PubMed Citations" section with properly formatted citations
4. The API response includes PubMed article data

## Testing

To test the PubMed integration:

1. Ensure you have a valid PubMed API key in your `.env.local` file
2. Set `INCLUDE_PUBMED_SEARCH=true` in your `.env.local` file
3. Run the research tool with a medical or scientific query
4. Verify that PubMed articles appear in the console output and final report

## Limitations

- The PubMed API has rate limits that may affect performance during extensive research
- Citation formatting is limited to a few common styles (NLM, MLA, Chicago)
- Abstract retrieval may be limited for some articles

## Recent Enhancements

### MeSH Term Integration (Added on [Current Date])

Enhanced the PubMed integration to use MeSH (Medical Subject Headings) terms for more accurate and relevant search results:

- Added a new `convertToMeshTerms` function that uses the LLM to convert natural language queries to optimized PubMed search queries with MeSH terms
- Updated the `searchPubMed` function to use MeSH terms when enabled
- Added a new environment variable `USE_MESH_TERMS` to control this feature
- Created a test script `test-mesh.ts` to verify MeSH term conversion

### MeSH Term Restrictiveness Control (Added on [Current Date])

Added user control over MeSH term restrictiveness to balance between precision and recall:

- Added a `MeshRestrictiveness` enum with three levels: LOW, MEDIUM, and HIGH
- Updated the CLI interface to ask users about their preferred restrictiveness level
- Added a new environment variable `MESH_RESTRICTIVENESS` to set the default level
- Updated the API to accept a meshRestrictiveness parameter
- Modified the LLM prompt to generate MeSH queries according to the selected restrictiveness level

This enhancement significantly improves the quality and relevance of PubMed search results by leveraging the standardized medical vocabulary used in the PubMed database.

## Future Improvements

Potential future enhancements to the PubMed integration:

- Add more citation styles
- Implement more advanced PubMed search parameters
- Add filtering options for publication date, journal, etc.
- Improve error handling for PubMed API rate limits
- Enhance MeSH term conversion with more specific subheadings and qualifiers
