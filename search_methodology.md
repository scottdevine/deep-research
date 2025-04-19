# Deep Research: Search Methodology and System Architecture

This document provides a detailed explanation of how the Deep Research system works, from initial query to final report generation.

## Overview of the Research Process

The Deep Research system follows a recursive, multi-stage process to conduct comprehensive research on a given topic:

1. **Query Analysis**: The system analyzes the user's initial query
2. **Search Query Generation**: Multiple search queries are generated based on the initial query
3. **Content Retrieval**: Web content and academic articles are retrieved for each search query
4. **Learning Extraction**: Key insights ("learnings") are extracted from the retrieved content
5. **Recursive Exploration**: Follow-up queries are generated and the process repeats
6. **Report Generation**: A comprehensive report is generated from all accumulated learnings

## Key Parameters

The research process is controlled by several key parameters:

- **Breadth**: Controls how many search queries are generated at each level (default: 3)
- **Depth**: Controls how many levels of recursive exploration are performed (default: 1)
- **MeSH Restrictiveness**: Controls how strictly PubMed queries are converted to MeSH terms

## Detailed Process Flow

### 1. Initial Query Processing

When a user submits a research query, the system:
- Analyzes the query to understand the research topic
- Determines the appropriate search strategy

### 2. Search Query Generation

The system generates multiple search queries using the `generateSerpQueries` function:
- The number of queries is determined by the `breadth` parameter
- Each query is designed to explore a different aspect of the research topic
- Each query includes a detailed "research goal" that guides further exploration

Example:
```javascript
const serpQueries = await generateSerpQueries({
  query: "Latest treatments for rheumatoid arthritis",
  numQueries: breadth, // e.g., 10
});
```

This might generate queries like:
1. "Clinical trial results for JAK inhibitors in rheumatoid arthritis"
2. "Biologic DMARDs efficacy comparison in rheumatoid arthritis"
3. "Emerging targeted therapies for rheumatoid arthritis"
...and so on.

### 3. Content Retrieval

For each generated search query, the system:

#### Web Content Retrieval
- Uses the Firecrawl API to search the web
- Retrieves up to 10 relevant web pages per query
- Extracts the content in markdown format

```javascript
const result = await firecrawl.search(serpQuery.query, {
  timeout: 15000,
  limit: 10,
  scrapeOptions: { formats: ['markdown'] },
});
```

#### Academic Article Retrieval
- If enabled, uses the PubMed API to search for academic articles
- Converts the query to MeSH terms for better results
- Retrieves up to 5 relevant articles per query

```javascript
const pubMedResult = await searchPubMed(serpQuery.query, 5, true, meshRestrictiveness);
```

### 4. Learning Extraction

For each search query, after retrieving all content:

1. **Content Consolidation**: All web content and PubMed articles for the query are combined
2. **Content Processing**: The content is trimmed and formatted for the LLM
3. **Learning Extraction**: The LLM analyzes the combined content and extracts up to 5 key learnings

```javascript
const newLearnings = await processSerpResult({
  query: serpQuery.query,
  result,
  numLearnings: 5,
  numFollowUpQuestions: newBreadth,
  pubMedArticles: newPubMedArticles,
});
```

The LLM is prompted to:
- Extract the most important insights from the content
- Make each learning unique and information-dense
- Include specific entities, metrics, numbers, and dates
- Format the learnings as concise, detailed statements

**Important Note**: The system extracts learnings per query, not per individual source. This means that for each search query, all retrieved content (potentially 10+ web pages and 5 PubMed articles) is analyzed together to extract 5 key learnings.

### 5. Recursive Exploration

If the `depth` parameter is greater than 1:

1. **Follow-up Query Generation**: The system generates follow-up questions based on the learnings
2. **Breadth Reduction**: The breadth is reduced by 25% for each level of depth
3. **Recursive Call**: The entire process repeats with the follow-up queries
4. **Learning Accumulation**: All learnings from all levels are accumulated

```javascript
const nextQuery = `
  Previous research goal: ${serpQuery.researchGoal}
  Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
`.trim();

return deepResearch({
  query: nextQuery,
  breadth: newBreadth,
  depth: newDepth,
  learnings: allLearnings,
  visitedUrls: allUrls,
  pubMedArticles: allPubMedArticles,
  meshRestrictiveness,
  onProgress,
});
```

### 6. Report Generation

Once all queries at all depth levels have been processed:

1. **Learning Compilation**: All learnings from all queries and all depth levels are compiled
2. **Source Preparation**: All sources (web pages and PubMed articles) are prepared for citation
3. **Report Generation**: The LLM generates a comprehensive report based on all learnings

```javascript
const report = await writeFinalReport({
  prompt: query,
  learnings,
  visitedUrls,
  pubMedArticles
});
```

The LLM is instructed to:
- Create a comprehensive and detailed report (5-7+ pages)
- Include all learnings from the research
- Structure the report with clear sections and subsections
- Include an executive summary
- Provide in-depth analysis, not just summaries
- Cover multiple perspectives and approaches
- Discuss implications, applications, and future directions
- Cite all sources properly

## Learning Extraction Deep Dive

The learning extraction process is a critical component of the system. Here's a deeper look at how it works:

### What is a "Learning"?

A "learning" is a concise, information-dense statement that captures a key insight from the research. Learnings are designed to:
- Contain specific, factual information
- Include entities, metrics, and dates when relevant
- Be self-contained and meaningful
- Represent the most important information from the sources

### Example Learnings

For a query about "Latest treatments for rheumatoid arthritis":

1. "JAK inhibitors (e.g., upadacitinib, filgotinib) have shown superior efficacy to TNF inhibitors in recent Phase III trials, with ACR70 response rates of 48% versus 35% at week 12, though with slightly increased risk of herpes zoster reactivation (3.1% vs 1.2%)."

2. "The FDA approved olokizumab (IL-6 inhibitor) in March 2024 for moderate-to-severe RA patients who failed TNF inhibitors, based on CREDO trials showing 63.6% ACR20 response at week 24 versus 40.6% for placebo."

### Learning Extraction Process

1. **Content Collection**: All content from a single search query is collected
2. **Content Formatting**: The content is formatted for the LLM
3. **LLM Analysis**: The LLM analyzes the content to identify key insights
4. **Learning Generation**: The LLM generates up to 5 learnings from the content
5. **Learning Storage**: The learnings are stored for later use in report generation

### Learning Extraction Prompt

The LLM is given a prompt like:

```
Given the following contents from a SERP search for the query <query>${query}</query>, 
generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, 
but feel free to return less if the contents are clear. Make sure each learning is unique 
and not similar to each other. The learnings should be concise and to the point, as detailed 
and information dense as possible. Make sure to include any entities like people, places, 
companies, products, things, etc in the learnings, as well as any exact metrics, numbers, 
or dates. The learnings will be used to research the topic further.
```

## Report Generation Deep Dive

The final report generation is where all the accumulated learnings are synthesized into a comprehensive document.

### Report Generation Process

1. **Learning Compilation**: All learnings from all queries and depth levels are compiled
2. **Source Preparation**: All sources are prepared for citation
3. **LLM Synthesis**: The LLM synthesizes the learnings into a coherent report
4. **Citation Addition**: Citations are added to all factual statements
5. **References Section**: A references section is added with all sources

### Report Generation Prompt

The LLM is given a prompt that instructs it to:

```
Given the following prompt from the user, write a COMPREHENSIVE and DETAILED final report on the topic using the learnings from research. This should be an extensive report that thoroughly covers all aspects of the topic.

Your report MUST:
1. Be extremely detailed and comprehensive (minimum 5-7 pages of content)
2. Include ALL the learnings from the research
3. Be well-structured with clear sections and subsections
4. Include an executive summary at the beginning
5. Provide in-depth analysis, not just summaries
6. Cover multiple perspectives and approaches
7. Discuss implications, applications, and future directions

VERY IMPORTANT: For EVERY factual statement in your report, you MUST include a citation to the relevant source.
```

## System Limitations and Considerations

### Current Limitations

1. **Learning Extraction Bottleneck**: The system currently extracts only 5 learnings per search query, regardless of how many sources are retrieved. This means that some information from the sources may not be included in the final report.

2. **Content Consolidation**: All content for a single query is processed together, which may lead to loss of context or nuance from individual sources.

3. **Fixed Parameters**: The number of learnings per query is fixed and not user-configurable.

### Potential Improvements

1. **Increased Learnings Per Query**: Increasing the number of learnings extracted per query would preserve more information.

2. **Two-Level Learning Extraction**: Implementing a two-level approach where learnings are first extracted from individual sources, then synthesized across sources.

3. **Content Clustering**: Clustering similar content sources together and extracting learnings from each cluster.

4. **User-Configurable Parameters**: Making key parameters like the number of learnings per query user-configurable.

## Conclusion

The Deep Research system uses a sophisticated, multi-stage process to conduct comprehensive research on a given topic. By generating multiple search queries, retrieving relevant content, extracting key learnings, and recursively exploring the topic, the system can produce detailed, well-cited reports on complex topics.

The system's architecture balances depth and breadth of research, information density, and computational efficiency to deliver high-quality research reports.
