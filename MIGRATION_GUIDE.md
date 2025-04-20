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

### Option A: Using Docker (Recommended)

The recommended way to run the Crawl4AI service is using Docker, which eliminates environment issues and ensures consistent behavior across different machines.

#### 1. Start the Services with Docker Compose

```bash
docker-compose up -d
```

This will start both the Crawl4AI service and the deep-research tool in Docker containers. The Crawl4AI service will be available at `http://crawl4ai:8000` within the Docker network.

#### 2. Access the Web UI

Open your browser and navigate to:

```
http://localhost:3002
```

#### 3. Verify the Integration

To verify that the Crawl4AI integration is working correctly:

```bash
curl http://localhost:8000/health
```

You should see a response like:

```json
{
  "status": "healthy",
  "service": "crawl4ai-service",
  "version": "1.0.0",
  "crawl4ai_available": true,
  "environment": "production",
  "timestamp": "2023-06-01T12:00:00.000000"
}
```

### Option B: Manual Setup

If you prefer to run the services manually, follow these steps:

#### 1. Start the Crawl4AI Service

First, you need to start the Crawl4AI service:

##### Using the Start Script

```bash
cd crawl4ai-service
pip install -r requirements.txt
./start.sh
```

The start script will:
- Set the Python path
- Create the cache directory
- Install Playwright browsers if needed
- Start the service

##### Alternative Manual Setup

```bash
cd crawl4ai-service
pip install -r requirements.txt
python -m playwright install chromium
python main.py
```

The service will start on port 8000 by default.

#### 2. Update Environment Variables

Update your `.env.local` file to include the Crawl4AI service URL:

```
# Crawl4AI Service settings
CRAWL4AI_SERVICE_URL="http://localhost:8000"
CRAWL4AI_CONCURRENCY="2"
CRAWL4AI_MOCK_MODE="false"  # Set to "true" for testing without the service
```

#### 3. Install Dependencies

Install the required Node.js dependencies:

```bash
npm install
```

#### 4. Run the Deep Research Tool

Run the deep-research tool as usual:

```bash
npm run api:enhanced
```

#### 5. Verify the Integration

Create a research query in the web UI and check the logs to ensure that Crawl4AI is being used for web searches.

## Troubleshooting

### Docker Issues

#### Service Not Starting

If the Docker containers are not starting properly, check the Docker logs:

```bash
docker-compose logs crawl4ai
```

Or for the deep-research container:

```bash
docker-compose logs deep-research
```

#### Connection Issues

If the deep-research tool cannot connect to the Crawl4AI service, make sure both containers are running:

```bash
docker-compose ps
```

Check that the service URL is correctly set to `http://crawl4ai:8000` in the `.env.local` file when using Docker.

#### Rebuilding the Containers

If you make changes to the code or configuration, rebuild the containers:

```bash
docker-compose build
docker-compose up -d
```

### Manual Setup Issues

#### Service Not Running

If you see errors like "Connection refused" or "ECONNREFUSED", make sure the Crawl4AI service is running:

```bash
curl http://localhost:8000/health
```

Should return a health status response. If not, check the service logs:

```bash
cat crawl4ai-service/crawl4ai-service.log
```

#### Python Dependencies

If you encounter Python dependency issues, make sure you have installed all the required dependencies:

```bash
pip install -r crawl4ai-service/requirements.txt
```

#### Chrome/Chromium Not Found

Crawl4AI requires Chrome or Chromium to be installed on your system. If you encounter errors related to Chrome, install it using Playwright:

```bash
python -m playwright install chromium
```

### General Issues

#### Using Mock Mode for Testing

If you're having trouble with the Crawl4AI service, you can use mock mode for testing:

1. Set `CRAWL4AI_MOCK_MODE="true"` in your `.env.local` file
2. Restart the API server

This will use mock data instead of making actual requests to the Crawl4AI service.

#### Debugging the Adapter

To debug the Crawl4AI adapter, check the API server logs for messages with the `[Crawl4AI]` prefix. These messages provide information about the adapter's operations, including search requests, responses, and errors.

#### Performance Issues

If you're experiencing performance issues:

1. Increase the concurrency limit by setting `CRAWL4AI_CONCURRENCY` to a higher value (e.g., 4 or 8)
2. Adjust the timeout settings in the adapter
3. Consider using the cache mode by setting `CACHE_MODE="USE_CACHE"` in the Crawl4AI service's `.env` file

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
