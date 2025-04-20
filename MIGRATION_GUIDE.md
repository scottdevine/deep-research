# Migration Guide: Firecrawl to Crawl4AI

This guide explains how to migrate from Firecrawl to Crawl4AI in the deep-research tool.

## Overview

We've replaced Firecrawl with Crawl4AI as the web crawling and search engine in the deep-research tool. This migration was done to reduce costs and leverage the open-source Crawl4AI library.

The migration uses a REST API approach, where:

1. A separate Crawl4AI service is run as a REST API
2. The deep-research tool makes HTTP requests to this service
3. The service returns the search results in a format compatible with the existing code

## Changes Made

1. **Removed Firecrawl Dependency**:
   - Removed `@mendable/firecrawl-js` from package.json
   - Added `axios` for making HTTP requests to the Crawl4AI service

2. **Created Crawl4AI Adapter**:
   - Added `src/crawl4ai-adapter.ts` to provide a compatible interface with Firecrawl
   - The adapter makes HTTP requests to the Crawl4AI service

3. **Updated Code**:
   - Updated imports in `deep-research.ts` and `enhanced-deep-research.ts`
   - Updated initialization code to use the Crawl4AI adapter
   - Updated environment variable references

4. **Created Crawl4AI Service**:
   - Added a FastAPI-based REST API service for Crawl4AI
   - The service exposes endpoints for search and health checks
   - The service can be run locally or in a Docker container

5. **Updated Environment Variables**:
   - Removed Firecrawl-specific environment variables
   - Added Crawl4AI-specific environment variables

## How to Use

### 1. Start the Crawl4AI Service

First, you need to start the Crawl4AI service:

```bash
cd crawl4ai-service
pip install -r requirements.txt
python main.py
```

Alternatively, you can use Docker:

```bash
cd crawl4ai-service
docker-compose up -d
```

The service will start on port 8000 by default.

### 2. Update Environment Variables

Update your `.env.local` file to include the Crawl4AI service URL:

```
CRAWL4AI_SERVICE_URL="http://localhost:8000"
CRAWL4AI_CONCURRENCY="2"
```

### 3. Install Dependencies

Install the required Node.js dependencies:

```bash
npm install
```

### 4. Run the Deep Research Tool

Run the deep-research tool as usual:

```bash
npm run api:enhanced
```

## Troubleshooting

### Service Not Running

If you see errors like "Connection refused" or "ECONNREFUSED", make sure the Crawl4AI service is running:

```bash
curl http://localhost:8000/health
```

Should return:

```json
{"status":"healthy"}
```

### Python Dependencies

If you encounter Python dependency issues, make sure you have installed all the required dependencies:

```bash
pip install -r crawl4ai-service/requirements.txt
```

### Chrome/Chromium Not Found

Crawl4AI requires Chrome or Chromium to be installed on your system. If you encounter errors related to Chrome, make sure it's installed and accessible.

## Differences from Firecrawl

While we've tried to maintain compatibility with Firecrawl, there are some differences:

1. **Performance**: Crawl4AI may have different performance characteristics than Firecrawl.
2. **Result Format**: The result format is similar but may have slight differences.
3. **Error Handling**: Error handling may be different, especially for timeouts and network errors.
4. **Caching**: Crawl4AI has its own caching mechanism, which is different from Firecrawl's.

## Future Improvements

1. **Performance Optimization**: Further optimize the Crawl4AI service for better performance.
2. **Error Handling**: Improve error handling and reporting.
3. **Caching**: Implement more sophisticated caching strategies.
4. **Monitoring**: Add monitoring and logging for better debugging.

## Conclusion

This migration from Firecrawl to Crawl4AI should provide a cost-effective and open-source alternative for web crawling and search in the deep-research tool. If you encounter any issues, please refer to the troubleshooting section or open an issue on the repository.
