// Enhanced report prompt to ensure more detailed and comprehensive reports

export function createEnhancedReportPrompt(
  prompt: string,
  reportLength: string,
  insightDetail: number,
  detailLevel: string,
  learningsString: string,
  sourcesString: string
): string {
  let promptTemplate = `Given the following prompt from the user, write a ${detailLevel} final report (${reportLength}) on the topic using the learnings from research.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>\n\n`;

  if (insightDetail >= 7) {
    promptTemplate += `
    Your report MUST:
    1. Be EXTREMELY detailed and comprehensive (${reportLength})
    2. Include ALL the information from the learnings in great detail
    3. Be well-structured with clear sections, subsections, and a logical flow
    4. Include a detailed executive summary at the beginning
    5. Provide in-depth analysis that builds upon the detailed learnings
    6. Cover multiple perspectives and approaches
    7. Discuss implications, applications, and future directions
    8. Maintain academic rigor throughout
    9. CRITICAL: Do not omit ANY important information from the learnings
    10. Expand each section with substantial detail, examples, and analysis
    `;
  } else if (insightDetail >= 4) {
    promptTemplate += `
    Your report MUST:
    1. Be detailed and thorough (${reportLength})
    2. Incorporate ALL the key information from the learnings
    3. Have a clear structure with appropriate sections and subsections
    4. Include a comprehensive executive summary
    5. Provide substantial analysis and insights for each topic
    6. Consider different perspectives where relevant
    7. CRITICAL: Do not omit ANY important information from the learnings
    8. Expand each section with sufficient detail, examples, and analysis
    `;
  } else {
    promptTemplate += `
    Your report MUST:
    1. Be clear and well-organized (${reportLength})
    2. Capture all the essential information from the learnings
    3. Have a logical structure with clear sections
    4. Focus on the most important points while providing adequate detail
    5. CRITICAL: Do not omit ANY important information from the learnings
    6. Provide enough detail to make the report informative and useful
    `;
  }

  promptTemplate += `\n\nVERY IMPORTANT: For EVERY factual statement in your report, you MUST include a citation to the relevant source. Here are the available sources you can cite:\n\n<sources>${sourcesString}</sources>\n\nCitation format:\n- For web sources: Use [web1], [web2], etc. at the end of the sentence or paragraph containing the information.\n- For PubMed sources: Use [pubmed1], [pubmed2], etc. at the end of the sentence or paragraph containing the information.\n\nYou MUST include at least one citation for every paragraph. If a paragraph contains information from multiple sources, include all relevant citations. If you're unsure which exact source a piece of information came from, cite multiple potential sources.\n\nExample of proper citation:\n"Recent studies have shown that immunotherapy is effective for treating certain types of cancer [web1][pubmed2]. However, the efficacy varies significantly based on cancer type and patient characteristics [pubmed1][web3]."\n\nADDITIONAL CRITICAL REQUIREMENTS:\n1. Your report MUST be at least 8,000 words in length to ensure comprehensive coverage\n2. You MUST include detailed examples, case studies, and specific data points whenever available\n3. You MUST explore multiple perspectives and approaches to the topic\n4. You MUST include a detailed analysis section for each major point\n5. You MUST NOT summarize or condense information unnecessarily\n6. You MUST expand on each learning with additional context and implications\n7. You MUST structure the report with clear headings, subheadings, and a logical flow\n\nRemember, this report should be ${detailLevel.toUpperCase()}, covering all aspects of the topic in EXTENSIVE detail.`;

  return promptTemplate;
}
