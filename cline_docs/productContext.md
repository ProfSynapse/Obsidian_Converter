# Product Context

## Purpose
This is a backend service designed to convert various file types and web content into Markdown format specifically for use with Obsidian, a knowledge management application.

## Problems Solved
- Enables users to convert different file formats (PDF, DOCX, PPTX, etc.) to Markdown
- Allows conversion of web content (URLs, YouTube videos) to Markdown
- Supports batch conversions of multiple files/URLs
- Handles multimedia content (audio/video) transcription and conversion
- Automates the process of creating Obsidian-compatible Markdown files

## How It Works
1. Accepts various input types:
   - File uploads (PDF, DOCX, PPTX, CSV, XLSX, etc.)
   - URLs (web pages, parent URLs for entire sites)
   - YouTube videos
   - Audio/video files for transcription

2. Processing Flow:
   - Validates incoming requests and file types
   - Routes to appropriate converter based on file type
   - Converts content to Markdown format
   - Packages results into ZIP files for download
   - Supports batch processing for multiple items

3. API Features:
   - RESTful endpoints for different conversion types
   - API key authentication for protected endpoints
   - Multipart form data handling for file uploads
   - Error handling and validation
   - CORS support for cross-origin requests
