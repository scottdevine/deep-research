# Deep Research: Search Methodology and System Architecture

This document provides a detailed explanation of how the Deep Research system works, from initial query to final report generation.

## Overview of the Research Process

The Deep Research system follows a recursive, multi-stage process to conduct comprehensive research on a given topic:

1. **Query Analysis**: The system analyzes the user's initial query
2. **Search Query Generation**: Multiple search queries are generated based on the initial query
3. **Content Retrieval**: Web content and academic articles are retrieved for each search query
4. **Learning Extraction**: Key insights ("learnings") are extracted from the retrieved content
5. **Recursive Exploration**: Follow-up queries are generated and the process repeats
6. **Learning Processing**: Learnings are processed using hierarchical aggregation and progressive summarization
7. **Content Selection**: Important content is selected based on relevance and importance
8. **Report Generation**: A comprehensive report is generated using either chunked or template-based approaches

## Key Parameters

The research process is controlled by several key parameters:

- **Breadth**: Controls how many search queries are generated at each level (default: 3)
- **Depth**: Controls how many levels of recursive exploration are performed (default: 1)
- **MeSH Restrictiveness**: Controls how strictly PubMed queries are converted to MeSH terms
- **Insight Detail**: Controls the depth and comprehensiveness of research insights (scale: 1-10, default: 5)

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
3. **Parameter Calculation**: The system calculates the appropriate token limit and number of learnings based on the Insight Detail parameter
4. **Learning Extraction**: The LLM analyzes the combined content and extracts key learnings with varying levels of detail

```javascript
const newLearnings = await processSerpResult({
  query: serpQuery.query,
  result,
  breadth,
  insightDetail, // Controls the depth and comprehensiveness of learnings
  pubMedArticles: newPubMedArticles,
});
```

The LLM is prompted to generate learnings with a level of detail corresponding to the Insight Detail parameter:

- **Low Detail (1-3)**: Concise, focused learnings (1000-2000 tokens, ~1-2 pages each)
- **Medium Detail (4-7)**: Detailed, informative learnings (2000-6000 tokens, ~3-6 pages each)
- **High Detail (8-10)**: Comprehensive, in-depth learnings (6000-10000 tokens, ~6-10 pages each)

At higher detail levels, learnings include:
- Structured content with clear sections
- Multiple perspectives and approaches
- Methodologies, limitations, and implications
- Specific examples, case studies, and applications
- Citations to specific sources

**Important Note**: The system adjusts the number of learnings based on the Insight Detail parameter. Higher detail levels result in fewer but more comprehensive learnings, while lower detail levels produce more concise learnings.

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

### 6. Learning Processing

After all queries at all depth levels have been processed, the system applies advanced processing to the learnings:

1. **Hierarchical Aggregation**: Learnings are organized into a hierarchical structure based on topics and relationships
2. **Progressive Summarization**: Learnings are summarized at different levels of detail to create a layered representation

```javascript
// Apply hierarchical aggregation to learnings
const hierarchicalLearnings = await aggregateHierarchicalLearnings(learnings);

// Apply progressive summarization
const summarizedLearnings = await progressiveSummarization(
  learnings,
  Math.max(...learnings.map(l => l.metadata.depth))
);
```

### 7. Content Selection

The system selects the most important content based on:

1. **Importance Rating**: Each learning has an importance rating indicating how central it is to the research topic
2. **Content Size Limits**: The system calculates the maximum content size based on the Insight Detail parameter
3. **Selection Algorithm**: The system selects content based on importance, ensuring comprehensive coverage

```javascript
const maxContentSize = calculateMaxContentSize(insightDetail);
const selectedLearnings = selectImportantContent(
  summarizedLearnings.layeredLearnings,
  maxContentSize
);
```

### 8. Report Generation

The system uses two different approaches for report generation based on the Insight Detail parameter:

#### High Detail Reports (Insight Detail ≥ 7)

For high detail reports, the system uses a chunked report generation approach:

1. **Report Outline Creation**: A detailed outline is created with major sections and subsections
2. **Learning Categorization**: Learnings are categorized according to the outline sections
3. **Section Processing**: Each section is processed independently with its relevant learnings
4. **Executive Summary Generation**: An executive summary is generated based on all sections
5. **Report Assembly**: The final report is assembled with proper structure and references

```javascript
// For high detail levels, use chunked report generation
finalReport = await writeFinalReportWithChunking({
  prompt,
  learnings: selectedLearnings,
  visitedUrls,
  pubMedArticles,
  insightDetail,
});
```

#### Lower Detail Reports (Insight Detail < 7)

For lower detail reports, the system uses a template-based approach:

1. **Domain Identification**: The research domain is identified (scientific, medical, business, etc.)
2. **Template Selection**: An appropriate report template is selected based on the domain
3. **Learning Mapping**: Learnings are mapped to template sections
4. **Section Generation**: Content is generated for each section based on the mapped learnings
5. **Report Assembly**: The final report is assembled according to the template structure

```javascript
// For lower detail levels, use template-based report generation
const domainType = await identifyResearchDomain(prompt, selectedLearnings);
finalReport = await templateBasedReportGeneration(
  prompt,
  selectedLearnings,
  insightDetail,
  visitedUrls,
  pubMedArticles
);
```

The report length and detail level are determined by the Insight Detail parameter:

- **Low Detail (1-3)**: Concise, focused report (approximately 3,000-5,000 words)
- **Medium Detail (4-7)**: Detailed, informative report (approximately 5,000-7,000 words)
- **High Detail (8-10)**: Comprehensive, in-depth report (approximately 7,000-10,000 words)

The system ensures that all sections have proper content, even when no specific learnings are available for a section, by generating content based on the section title and purpose.

## Learning Extraction Deep Dive

The learning extraction process is a critical component of the system. Here's a deeper look at how it works:

### What is a "Structured Learning"?

A "structured learning" is a comprehensive insight that captures key information from the research in a structured format. Each structured learning includes:

- **ID**: A unique identifier for the learning
- **Title**: A descriptive title for the learning
- **Content**: The detailed content exploring this learning
- **Sources**: References to specific sources used
- **Key Points**: Key points extracted from this learning
- **Importance**: A rating indicating how central this learning is to the research topic
- **Topics**: Primary topics this learning relates to
- **Metadata**: Additional information including depth, confidence score, and content type

The structure and detail level of learnings vary based on the Insight Detail parameter:

#### Low Detail Learnings (Insight Detail 1-3)
- Concise, information-dense statements (1000-2000 tokens, ~1-2 pages)
- Contain specific, factual information
- Include entities, metrics, and dates when relevant
- Focus on essential information
- Include 1-3 key topics

#### Medium Detail Learnings (Insight Detail 4-7)
- Detailed, informative content (2000-6000 tokens, ~3-6 pages)
- Include specific facts, figures, and context
- Provide analysis beyond just summarizing information
- Reference specific sources
- Have a logical structure
- Include 3-7 key topics

#### High Detail Learnings (Insight Detail 8-10)
- Comprehensive, in-depth analysis (6000-10000 tokens, ~6-10 pages)
- Structured with clear sections and logical flow
- Analyze topics from multiple perspectives
- Include methodologies, limitations, and implications
- Compare and contrast different viewpoints
- Incorporate specific examples, case studies, and applications
- Cite specific sources for key information
- Include 5-10 key topics

### Example Learnings

#### Low Detail Example (Insight Detail 1-3)
"JAK inhibitors (e.g., upadacitinib, filgotinib) have shown superior efficacy to TNF inhibitors in recent Phase III trials, with ACR70 response rates of 48% versus 35% at week 12, though with slightly increased risk of herpes zoster reactivation (3.1% vs 1.2%)."

#### High Detail Example (Insight Detail 8-10)
```
# JAK Inhibitors: A Paradigm Shift in Rheumatoid Arthritis Treatment

## Introduction
Janus kinase (JAK) inhibitors represent a significant advancement in the treatment of rheumatoid arthritis (RA), offering an oral alternative to injectable biologic therapies. This class of medications has demonstrated remarkable efficacy in clinical trials and real-world settings, potentially changing the treatment paradigm for moderate-to-severe RA patients.

## Mechanism of Action
JAK inhibitors target the intracellular signaling pathway known as the JAK-STAT pathway, which plays a crucial role in immune cell activation and inflammatory processes. By selectively blocking specific JAK enzymes (JAK1, JAK2, JAK3, and TYK2), these medications interrupt the signaling of multiple cytokines simultaneously, providing a broader mechanism of action than biologics that target single cytokines.

## Clinical Efficacy
Recent Phase III clinical trials have demonstrated superior efficacy of JAK inhibitors compared to TNF inhibitors:

- The SELECT-COMPARE trial showed that upadacitinib achieved ACR70 response rates of 48% versus 35% for adalimumab at week 12
- Filgotinib demonstrated similar superiority in the FINCH-1 trial with ACR70 rates of 43% versus 31% for adalimumab
- Baricitinib showed comparable results in the RA-BEAM trial

Particularly noteworthy is the rapid onset of action, with significant improvements often observed within 1-2 weeks of treatment initiation.

## Safety Profile
While generally well-tolerated, JAK inhibitors have specific safety considerations:

- Increased risk of herpes zoster reactivation (3.1% vs 1.2% for TNF inhibitors)
- Elevated liver enzymes in approximately 5-8% of patients
- Small increases in serum lipid levels
- Rare but serious adverse events including venous thromboembolism (VTE) and major adverse cardiovascular events (MACE)

The FDA has issued boxed warnings regarding these risks, particularly for tofacitinib.

## Comparative Advantages
Compared to biologic DMARDs, JAK inhibitors offer several advantages:

- Oral administration (versus injection)
- No immunogenicity (versus biologics)
- Rapid onset of action
- Flexibility in dosing and combination therapy
- No need for refrigeration or special handling

## Future Directions
Next-generation JAK inhibitors with greater selectivity are in development, potentially offering improved safety profiles while maintaining efficacy. Additionally, ongoing research is exploring JAK inhibitors in other inflammatory conditions beyond RA.

## Conclusion
JAK inhibitors represent a significant advancement in RA treatment, offering a potent alternative to biologic therapies with unique advantages. Their superior efficacy, rapid onset of action, and oral administration make them an attractive option for many patients, though careful consideration of their safety profile is essential.
```

### Learning Extraction Process

1. **Content Collection**: All content from a single search query is collected
2. **Content Formatting**: The content is formatted for the LLM
3. **Parameter Calculation**: The system calculates the appropriate token limit and number of learnings based on the Insight Detail parameter
4. **LLM Analysis**: The LLM analyzes the content to identify key insights
5. **Structured Learning Generation**: The LLM generates structured learnings with the appropriate level of detail
6. **Metadata Addition**: Each learning is enriched with metadata including depth, confidence score, and content type
7. **Learning Storage**: The structured learnings are stored for later processing and report generation

### Learning Extraction Prompt

The LLM is given a prompt that varies based on the Insight Detail parameter. For high detail (8-10), the prompt includes:

```
Given the following contents from a SERP search for the query <query>${query}</query>,
generate ${numLearnings} comprehensive and in-depth learnings.

Each learning should:
1. Have a clear, descriptive title
2. Be extremely thorough and comprehensive (6-10 pages of content)
3. Deeply analyze the topic with multiple perspectives
4. Include all relevant facts, figures, statistics, and data points
5. Discuss methodologies, limitations, and implications
6. Compare and contrast different viewpoints or approaches
7. Incorporate specific examples, case studies, or applications
8. Cite specific sources for key information
9. Be structured with clear sections and logical flow

Make sure each learning is unique and focuses on a different aspect of the topic.
Include specific entities, metrics, numbers, and dates where relevant.
For each learning, include a list of sources that contributed to that learning.
```

For medium detail (4-7), the prompt is adjusted to request more concise but still detailed learnings, and for low detail (1-3), the prompt requests brief, focused learnings.

## Advanced Report Generation Deep Dive

The enhanced report generation process uses advanced techniques to create comprehensive, well-structured reports. The system employs two different approaches based on the Insight Detail parameter.

### Chunked Report Generation Process (High Detail)

For high detail reports (Insight Detail ≥ 7), the system uses a chunked approach:

1. **Report Outline Creation**: A detailed outline is created with major sections and subsections
2. **Learning Categorization**: Learnings are categorized according to the outline sections
3. **Section Processing**: Each section is processed independently with its relevant learnings
4. **Executive Summary Generation**: An executive summary is generated based on all sections
5. **Report Assembly**: The final report is assembled with proper structure and references

### Template-Based Report Generation Process (Lower Detail)

For lower detail reports (Insight Detail < 7), the system uses a template-based approach:

1. **Domain Identification**: The research domain is identified (scientific, medical, business, etc.)
2. **Template Selection**: An appropriate report template is selected based on the domain
3. **Learning Mapping**: Learnings are mapped to template sections
4. **Section Generation**: Content is generated for each section based on the mapped learnings
5. **Report Assembly**: The final report is assembled according to the template structure

### Empty Section Handling

The system ensures that all sections have proper content, even when no specific learnings are available for a section, by generating content based on the section title and purpose. This ensures that the report is comprehensive and well-structured, with no empty sections.

### Report Length and Detail

The Insight Detail parameter controls the length and detail level of the final report:

#### Low Detail Reports (Insight Detail 1-3)
- Concise, focused reports (approximately 3,000-5,000 words)
- Essential information with minimal elaboration
- Clear structure with basic sections
- Focus on the most important points

#### Medium Detail Reports (Insight Detail 4-7)
- Detailed, informative reports (approximately 5,000-7,000 words)
- Thorough coverage of the topic
- Well-structured with appropriate sections
- Executive summary and analysis
- Different perspectives where relevant

#### High Detail Reports (Insight Detail 8-10)
- Comprehensive, in-depth reports (approximately 7,000-10,000 words)
- Exhaustive coverage of all aspects of the topic
- Sophisticated structure with sections, subsections, and logical flow
- Detailed executive summary
- In-depth analysis that builds upon the detailed learnings
- Multiple perspectives and approaches
- Thorough discussion of implications, applications, and future directions
- Academic rigor throughout

### Report Generation Prompt

The LLM is given a prompt that varies based on the Insight Detail parameter. For high detail (8-10), the prompt includes:

```
Given the following prompt from the user, write a COMPREHENSIVE and IN-DEPTH final report (30-50 pages) on the topic using the learnings from research.

Your report MUST:
1. Be extremely detailed and comprehensive (30-50 pages of content)
2. Include ALL the learnings from the research
3. Be well-structured with clear sections, subsections, and a logical flow
4. Include an executive summary at the beginning
5. Provide in-depth analysis that builds upon the detailed learnings
6. Cover multiple perspectives and approaches
7. Discuss implications, applications, and future directions
8. Maintain academic rigor throughout

VERY IMPORTANT: For EVERY factual statement in your report, you MUST include a citation to the relevant source.
```

For medium detail (4-7), the prompt is adjusted to request a more concise but still detailed report, and for low detail (1-3), the prompt requests a brief, focused report.

## System Limitations and Considerations

### Current Limitations

1. **Content Consolidation**: All content for a single query is processed together, which may lead to loss of context or nuance from individual sources.

2. **Token Limits**: At very high Insight Detail levels (9-10), the system may approach the token limits of the underlying LLM, potentially requiring multiple API calls or model with larger context windows.

3. **Processing Time**: Higher Insight Detail levels require more processing time due to the increased complexity and length of the generated content.

### Architectural Improvements

1. **Structured Learning Representation**: Learnings are now represented as structured objects with metadata, enabling more sophisticated processing and analysis.

2. **Hierarchical Learning Aggregation**: Learnings are organized into a hierarchical structure based on topics and relationships, providing a more coherent understanding of the research domain.

3. **Progressive Summarization**: Learnings are summarized at different levels of detail to create a layered representation, allowing for more efficient processing and presentation.

4. **Importance-Based Content Selection**: Content is selected based on importance ratings, ensuring that the most relevant information is included in the report.

5. **Chunked Report Generation**: For high detail reports, the system uses a chunked approach that processes each section independently, allowing for more detailed and comprehensive reports.

6. **Template-Based Report Generation**: For lower detail reports, the system uses a template-based approach that adapts to the research domain, providing a more structured and coherent report.

7. **Empty Section Handling**: The system ensures that all sections have proper content, even when no specific learnings are available for a section, by generating content based on the section title and purpose.

### Recent Improvements

1. **Insight Detail Parameter**: The addition of the Insight Detail parameter (scale 1-10) allows users to control the depth and comprehensiveness of research insights and reports.

2. **Dynamic Learning Count**: The system now dynamically adjusts the number of learnings based on the Insight Detail parameter, extracting fewer but more comprehensive learnings at higher detail levels.

3. **Scaled Token Limits**: Token limits for learnings now scale based on the Insight Detail parameter (1000-10000 tokens), allowing for much more detailed and comprehensive insights.

4. **Enhanced Report Generation**: Reports are now generated with varying levels of detail (3,000-10,000 words) based on the Insight Detail parameter.

5. **Schema Validation Compatibility**: The system has been updated to ensure compatibility with OpenAI's schema validation requirements, preventing errors during learning extraction.

### Potential Future Improvements

1. **Two-Level Learning Extraction**: Implementing a two-level approach where learnings are first extracted from individual sources, then synthesized across sources.

2. **Content Clustering**: Clustering similar content sources together and extracting learnings from each cluster.

3. **Advanced Visualization**: Adding data visualization capabilities for reports at higher detail levels.

4. **Interactive Reports**: Creating interactive reports that allow users to expand or collapse sections based on their interest in specific aspects of the topic.

## Conclusion

The Deep Research system uses a sophisticated, multi-stage process to conduct comprehensive research on a given topic. By generating multiple search queries, retrieving relevant content, extracting structured learnings, and recursively exploring the topic, the system can produce detailed, well-cited reports on complex topics.

The enhanced architecture with hierarchical aggregation, progressive summarization, importance-based content selection, and advanced report generation techniques ensures that the system produces high-quality, comprehensive reports that reflect the extensive data collected during the research process.

The system balances depth and breadth of research, information density, and computational efficiency to deliver research reports that meet the user's specific needs, with the level of detail controlled by the Insight Detail parameter.
