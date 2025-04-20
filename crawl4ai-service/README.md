# Crawl4AI Service

This is a REST API service for the Crawl4AI web crawler, designed to replace Firecrawl in the deep-research tool.

## Features

- REST API for web crawling and search
- Google search integration
- Markdown content extraction
- Configurable caching
- CORS support for cross-origin requests

## Requirements

- Python 3.7+
- Crawl4AI library
- FastAPI
- Uvicorn

## Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Make sure you have Chrome or Chromium installed on your system.

## Usage

### Starting the Service

```bash
python main.py
```

The service will start on port 8000 by default. You can change the port by setting the `PORT` environment variable.

### API Endpoints

#### GET /

Returns a simple message indicating that the service is running.

#### POST /search

Performs a search using Google and crawls the resulting URLs.

**Request Body:**

```json
{
  "query": "benefits of meditation",
  "limit": 10,
  "timeout": 15000,
  "formats": ["markdown"],
  "headless": true,
  "cache_mode": "BYPASS",
  "word_count_threshold": 100,
  "excluded_tags": ["nav", "footer", "aside", "script", "style"],
  "remove_overlay_elements": true
}
```

**Response:**

```json
{
  "data": [
    {
      "url": "https://example.com",
      "title": "Example Page",
      "content": "<html>...</html>",
      "markdown": "# Example Page\n\nThis is an example page.",
      "links": {
        "internal": ["https://example.com/page1", "https://example.com/page2"],
        "external": ["https://external.com"]
      },
      "media": {
        "images": [
          {
            "src": "https://example.com/image.jpg",
            "alt": "Example Image"
          }
        ]
      },
      "metadata": {
        "title": "Example Page",
        "description": "This is an example page."
      },
      "success": true
    }
  ],
  "status": "success",
  "message": "Found 1 results for query: benefits of meditation"
}
```

#### GET /health

Returns a health check response.

## Docker

You can also run the service using Docker:

```bash
docker-compose up -d
```

This will build and start the service in a Docker container.

## Environment Variables

- `PORT`: The port to run the service on (default: 8000)
- `CRAWL4AI_CACHE_DIR`: The directory to store cache files (default: ./cache)
- `CRAWL4AI_LOG_LEVEL`: The log level for Crawl4AI (default: INFO)

## Integration with Deep Research Tool

This service is designed to be used with the deep-research tool as a replacement for Firecrawl. The deep-research tool will make HTTP requests to this service to perform web searches and content extraction.
