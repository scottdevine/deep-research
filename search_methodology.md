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
- **Insight Detail**: Controls the depth and comprehensiveness of research insights (scale: 1-10, default: 5)
- **Model Selection**: Determines which AI model is used for all stages of the research process

## Detailed Process Flow

### 1. Initial Query Processing

When a user submits a research query, the system:
- Analyzes the query to understand the research topic
- Determines the appropriate search strategy

### 2. Model Selection and Follow-up Questions

After the initial query processing:

1. **Model Selection**: The user selects which AI model to use for the research process
   - The system fetches available models from OpenRouter API
   - Models are grouped by provider (Anthropic, OpenAI, Meta, etc.)
   - Each model displays its context window size
   - The selected model is used consistently throughout the entire research process

2. **Follow-up Question Generation**: The system generates follow-up questions to clarify the research direction
   - Uses the selected model to generate questions relevant to the research topic
   - Implements multiple fallback mechanisms to ensure reliable question generation:
     - First attempts structured JSON output with schema validation
     - If that fails, extracts JSON from markdown code blocks
     - If that fails, falls back to text generation and parsing
     - For specific topics (e.g., 340B drug program), provides domain-specific fallback questions
     - As a last resort, provides generic research clarification questions
   - Questions are tailored to help refine the research scope and direction

### 3. Search Query Generation

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

### 4. Content Retrieval

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

### 5. Learning Extraction

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

### 6. Recursive Exploration

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
  modelId, // Pass the selected model ID to maintain consistency
  insightDetail,
  onProgress,
});
```

### 7. Report Generation

Once all queries at all depth levels have been processed:

1. **Learning Compilation**: All learnings from all queries and all depth levels are compiled
2. **Source Preparation**: All sources (web pages and PubMed articles) are prepared for citation
3. **Report Length Determination**: The system determines the appropriate report length based on the Insight Detail parameter
4. **Report Generation**: The LLM generates a report with a level of detail corresponding to the Insight Detail parameter

```javascript
const report = await writeFinalReport({
  prompt: query,
  learnings,
  visitedUrls,
  pubMedArticles,
  modelId, // Use the selected model for report generation
  insightDetail // Controls the depth and comprehensiveness of the report
});
```

The report length and detail level are determined by the Insight Detail parameter:

- **Low Detail (1-3)**: Concise, focused report (3-7 pages)
- **Medium Detail (4-7)**: Detailed, informative report (7-30 pages)
- **High Detail (8-10)**: Comprehensive, in-depth report (30-50 pages)

The LLM is instructed to:
- Create a report with the appropriate level of detail based on the Insight Detail parameter
- Include all learnings from the research
- Structure the report with clear sections and subsections
- Include an executive summary
- Provide analysis appropriate to the detail level
- Cover multiple perspectives and approaches (especially at higher detail levels)
- Discuss implications, applications, and future directions
- Cite all sources properly

## Learning Extraction Deep Dive

The learning extraction process is a critical component of the system. Here's a deeper look at how it works:

### What is a "Learning"?

A "learning" is an insight that captures key information from the research. The structure and detail level of learnings vary based on the Insight Detail parameter:

#### Low Detail Learnings (Insight Detail 1-3)
- Concise, information-dense statements (1000-2000 tokens, ~1-2 pages)
- Contain specific, factual information
- Include entities, metrics, and dates when relevant
- Focus on essential information

#### Medium Detail Learnings (Insight Detail 4-7)
- Detailed, informative content (2000-6000 tokens, ~3-6 pages)
- Include specific facts, figures, and context
- Provide analysis beyond just summarizing information
- Reference specific sources
- Have a logical structure

#### High Detail Learnings (Insight Detail 8-10)
- Comprehensive, in-depth analysis (6000-10000 tokens, ~6-10 pages)
- Structured with clear sections and logical flow
- Analyze topics from multiple perspectives
- Include methodologies, limitations, and implications
- Compare and contrast different viewpoints
- Incorporate specific examples, case studies, and applications
- Cite specific sources for key information

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
5. **Learning Generation**: The LLM generates learnings with the appropriate level of detail
6. **Learning Storage**: The learnings are stored for later use in report generation

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

## Report Generation Deep Dive

The final report generation is where all the accumulated learnings are synthesized into a comprehensive document. The level of detail in the report is controlled by the Insight Detail parameter.

### Report Generation Process

1. **Learning Compilation**: All learnings from all queries and depth levels are compiled
2. **Source Preparation**: All sources are prepared for citation
3. **Report Length Determination**: The system determines the appropriate report length based on the Insight Detail parameter
4. **LLM Synthesis**: The LLM synthesizes the learnings into a coherent report with the appropriate level of detail
5. **Citation Addition**: Citations are added to all factual statements
6. **References Section**: A references section is added with all sources

### Report Length and Detail

The Insight Detail parameter controls the length and detail level of the final report:

#### Low Detail Reports (Insight Detail 1-3)
- Concise, focused reports (3-7 pages)
- Essential information with minimal elaboration
- Clear structure with basic sections
- Focus on the most important points

#### Medium Detail Reports (Insight Detail 4-7)
- Detailed, informative reports (7-30 pages)
- Thorough coverage of the topic
- Well-structured with appropriate sections
- Executive summary and analysis
- Different perspectives where relevant

#### High Detail Reports (Insight Detail 8-10)
- Comprehensive, in-depth reports (30-50 pages)
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

### Recent Improvements

1. **Insight Detail Parameter**: The addition of the Insight Detail parameter (scale 1-10) allows users to control the depth and comprehensiveness of research insights and reports.

2. **Dynamic Learning Count**: The system now dynamically adjusts the number of learnings based on the Insight Detail parameter, extracting fewer but more comprehensive learnings at higher detail levels.

3. **Scaled Token Limits**: Token limits for learnings now scale based on the Insight Detail parameter (1000-10000 tokens), allowing for much more detailed and comprehensive insights.

4. **Enhanced Report Generation**: Reports are now generated with varying levels of detail (3-50 pages) based on the Insight Detail parameter.

5. **Model Selection**: Users can now select from a comprehensive list of AI models from OpenRouter, with the selected model used consistently throughout the entire research process.

6. **Robust Follow-up Question Generation**: The system now implements multiple fallback mechanisms for generating follow-up questions, ensuring reliable question generation even when models return unexpected formats:
   - Structured JSON output with schema validation
   - JSON extraction from markdown code blocks
   - Text generation and parsing
   - Domain-specific fallback questions for certain topics
   - Generic research clarification questions as a last resort

### Potential Future Improvements

1. **Two-Level Learning Extraction**: Implementing a two-level approach where learnings are first extracted from individual sources, then synthesized across sources.

2. **Content Clustering**: Clustering similar content sources together and extracting learnings from each cluster.

3. **Advanced Visualization**: Adding data visualization capabilities for reports at higher detail levels.

4. **Interactive Reports**: Creating interactive reports that allow users to expand or collapse sections based on their interest in specific aspects of the topic.

## Conclusion

The Deep Research system uses a sophisticated, multi-stage process to conduct comprehensive research on a given topic. By generating multiple search queries, retrieving relevant content, extracting key learnings, and recursively exploring the topic, the system can produce detailed, well-cited reports on complex topics.

The system's architecture balances depth and breadth of research, information density, and computational efficiency to deliver high-quality research reports.
