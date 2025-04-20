import os
import asyncio
import logging
from typing import List, Optional, Dict, Any, Union
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("crawl4ai-service")

# Import Crawl4AI
try:
    from crawl4ai import (
        AsyncWebCrawler,
        BrowserConfig,
        CrawlerRunConfig,
        CacheMode,
        DefaultMarkdownGenerator,
        PruningContentFilter,
        CrawlResult
    )
except ImportError:
    logger.error("Failed to import Crawl4AI. Make sure it's installed correctly.")
    raise

# Initialize FastAPI app
app = FastAPI(
    title="Crawl4AI Service",
    description="REST API service for Crawl4AI web crawler",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request and response models
class SearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=50)
    timeout: int = Field(default=15000, ge=1000, le=60000)
    formats: List[str] = Field(default=["markdown"])
    headless: bool = Field(default=True)
    cache_mode: str = Field(default="BYPASS")
    word_count_threshold: int = Field(default=100, ge=0)
    excluded_tags: List[str] = Field(default=["nav", "footer", "aside", "script", "style"])
    remove_overlay_elements: bool = Field(default=True)

class SearchResult(BaseModel):
    url: str
    title: Optional[str] = None
    content: Optional[str] = None
    markdown: Optional[str] = None
    links: Optional[Dict[str, List[str]]] = None
    media: Optional[Dict[str, List[Dict[str, Any]]]] = None
    metadata: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    success: bool = True

class SearchResponse(BaseModel):
    data: List[SearchResult]
    status: str = "success"
    message: Optional[str] = None

# Store active crawling tasks
active_tasks = {}

@app.get("/")
async def root():
    return {"message": "Crawl4AI Service is running"}

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    try:
        logger.info(f"Received search request: {request.query}")
        
        # Configure browser
        browser_config = BrowserConfig(
            headless=request.headless,
            timeout=request.timeout / 1000  # Convert ms to seconds
        )
        
        # Configure crawler
        cache_mode = CacheMode.BYPASS
        if request.cache_mode == "USE_CACHE":
            cache_mode = CacheMode.USE_CACHE
        elif request.cache_mode == "UPDATE_CACHE":
            cache_mode = CacheMode.UPDATE_CACHE
            
        crawler_config = CrawlerRunConfig(
            cache_mode=cache_mode,
            session_id=f"deep-research-{request.query[:20]}",
            excluded_tags=request.excluded_tags,
            remove_overlay_elements=request.remove_overlay_elements,
            word_count_threshold=request.word_count_threshold,
            markdown_generator=DefaultMarkdownGenerator(
                content_filter=PruningContentFilter(
                    threshold=0.48, 
                    threshold_type="fixed", 
                    min_word_threshold=request.word_count_threshold
                )
            ),
        )
        
        # Initialize web crawler and perform search
        results = await perform_search(request.query, request.limit, browser_config, crawler_config)
        
        # Format results
        search_results = []
        for result in results:
            if result.success:
                search_results.append(
                    SearchResult(
                        url=result.url,
                        title=result.metadata.get("title", ""),
                        content=result.html if "html" in request.formats else None,
                        markdown=result.markdown.raw_markdown if hasattr(result.markdown, "raw_markdown") else result.markdown,
                        links={
                            "internal": result.links.get("internal", []),
                            "external": result.links.get("external", [])
                        },
                        media={
                            "images": result.media.get("images", [])
                        },
                        metadata=result.metadata,
                        success=True
                    )
                )
            else:
                search_results.append(
                    SearchResult(
                        url=result.url,
                        error_message=result.error_message if hasattr(result, "error_message") else "Failed to crawl",
                        success=False
                    )
                )
        
        return SearchResponse(
            data=search_results,
            status="success",
            message=f"Found {len(search_results)} results for query: {request.query}"
        )
    
    except Exception as e:
        logger.error(f"Error processing search request: {str(e)}", exc_info=True)
        return SearchResponse(
            data=[],
            status="error",
            message=f"Error processing search request: {str(e)}"
        )

async def perform_search(query: str, limit: int, browser_config: BrowserConfig, crawler_config: CrawlerRunConfig):
    async with AsyncWebCrawler(config=browser_config) as crawler:
        # Use Google search to get URLs
        try:
            search_results = await crawler.google_search(
                query=query,
                num_results=limit
            )
            
            # Extract URLs from search results
            urls = [result["url"] for result in search_results]
            
            # Crawl each URL
            results = await crawler.arun_many(
                urls=urls,
                config=crawler_config
            )
            
            return results
        except Exception as e:
            logger.error(f"Error during search: {str(e)}", exc_info=True)
            raise

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
