# Report Size Improvements

This document outlines the changes made to increase the size and detail of research reports in the Deep Research tool.

## Problem Statement

Despite setting high depth and breadth parameters, the AI-generated reports were much shorter than expected (3,000-3,500 words vs. claimed 8,000+ words). The user requested that there be no token limit on report generation, with report length based solely on the learnings provided.

## Root Causes Identified

1. **Missing Explicit Token Limits**: While the code commented that there was "no max_tokens parameter," this actually meant the model was using default token limits, which were likely conservative.

2. **Qualitative vs. Quantitative Length Instructions**: The prompts used qualitative descriptions like "comprehensive" and "detailed" rather than explicit word count targets.

3. **System Prompt Limitations**: The system prompt stated "The length of your report should be determined by the content of the learnings, not by arbitrary word counts," which may have been interpreted as a constraint.

4. **Learning Extraction Limitations**: Higher detail levels actually extracted fewer learnings (2-3 for high detail vs. 5-8 for low detail), potentially limiting the total content available for the report.

5. **Report Length Descriptions**: The `getReportLength` function provided qualitative descriptions without specific word count targets.

## Changes Implemented

1. **Explicit Token Limits**:
   - Modified `writeFinalReport` to use the `calculateReportTokenLimit` function
   - Set explicit `max_tokens` parameter based on insight detail level
   - Added word count targets to schema description

2. **Increased Token Limits**:
   - Updated `calculateReportTokenLimit` to use much higher token limits:
     - Level 1: ~8000 tokens (concise report, ~6000 words)
     - Level 5: ~20000 tokens (detailed report, ~15000 words)
     - Level 10: ~32000 tokens (comprehensive report, ~24000 words)

3. **Explicit Word Count Targets**:
   - Added explicit word count targets to report prompts:
     - High detail (insightDetail >= 8): 15,000-20,000 words
     - Medium detail (insightDetail >= 5): 8,000-15,000 words
     - Low detail (insightDetail >= 3): 5,000-8,000 words
     - Very low detail: 3,000-5,000 words

4. **Enhanced Report Requirements**:
   - Added explicit instructions to aim for specific word counts
   - Added instructions to expand on learnings with additional context, analysis, and implications
   - Added requirements for detailed examples, case studies, and background information

5. **Updated System Prompt**:
   - Changed "The length of your report should be determined by the content of the learnings, not by arbitrary word counts" to:
   - "Generate LONG, COMPREHENSIVE reports that fully explore all aspects of the topic in great detail."
   - "When given a word count target, treat it as a MINIMUM, not a maximum - longer reports with more detail are better."

6. **Increased Learning Count**:
   - Modified `calculateLearningsCount` to extract more learnings even at higher detail levels:
     - High detail (insightDetail >= 8): 3-5 learnings (was 2-3)
     - Medium detail (insightDetail >= 5): 4-7 learnings (was 3-5)
     - Low detail: 5-10 learnings (was 5-8)

7. **Explicit Report Length Descriptions**:
   - Updated `getReportLength` to include specific word count targets:
     - High detail: "an extremely comprehensive, in-depth report (15,000-20,000 words)..."
     - Medium detail: "a very detailed report (8,000-15,000 words)..."
     - Low detail: "a moderately detailed report (5,000-8,000 words)..."
     - Very low detail: "a well-structured report (3,000-5,000 words)..."

## Expected Outcomes

These changes should result in significantly longer and more detailed reports, especially at higher insight detail levels. The explicit word count targets and token limits should ensure that the model generates reports that match the expected length based on the insight detail parameter.

## Testing

To test these changes, run a research query with various insight detail levels and compare the word counts of the generated reports. The reports should now be much closer to the target word counts specified in the prompts.
