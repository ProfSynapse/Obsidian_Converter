# Omni-Converter Project Documentation

Welcome to the **Omni-Converter** project documentation! This guide provides a comprehensive overview of the project's folder structure, detailing the purpose and functionality of each directory and file. Whether you're a new developer onboarding to the project or a contributor seeking clarity, this documentation will help you navigate and understand the project's architecture.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Backend Structure](#2-backend-structure)
   - [2.1. Folder Hierarchy](#21-folder-hierarchy)
   - [2.2. Detailed Folder and File Descriptions](#22-detailed-folder-and-file-descriptions)
3. [Frontend Structure](#3-frontend-structure)
   - [3.1. Folder Hierarchy](#31-folder-hierarchy)
   - [3.2. Detailed Folder and File Descriptions](#32-detailed-folder-and-file-descriptions)
4. [Shared Utilities](#4-shared-utilities)
   - [4.1. Folder Hierarchy](#41-folder-hierarchy)
   - [4.2. Detailed Folder and File Descriptions](#42-detailed-folder-and-file-descriptions)
5. [Root-Level Files](#5-root-level-files)
6. [Additional Resources](#6-additional-resources)

---

## 1. Project Overview

**Omni-Converter** is a comprehensive information processing and formatting application designed to handle various file types and content sources. It provides functionalities such as file conversion, content enhancement, transcription, scraping, and output formatting. The project is divided into two main components:

- **Backend:** Handles data processing, API endpoints, authentication, and integrations with external services.
- **Frontend:** Provides a user interface for uploading files, inputting URLs, selecting processing options, and displaying results.

---

## 2. Backend Structure

The backend is responsible for processing inputs, enhancing content, managing services, and exposing API endpoints. It is organized into several specialized directories to maintain modularity and scalability.

### 2.1. Folder Hierarchy

```
backend/
├── processed/
├── src/
│   ├── inputProcessors/
│   │   ├── textProcessor.js
│   │   ├── docxProcessor.js
│   │   ├── pdfProcessor.js
│   │   ├── audioProcessor.js
│   │   ├── videoProcessor.js
│   │   ├── imageProcessor.js
│   │   └── index.js
│   ├── enhancers/
│   │   ├── textEnhancer.js
│   │   ├── imageEnhancer.js
│   │   ├── enhancerInterface.js
│   │   └── index.js
│   ├── outputFormatters/
│   │   ├── documentFormats/
│   │   │   ├── pdfFormatter.js
│   │   │   ├── docxFormatter.js
│   │   │   └── txtFormatter.js
│   │   ├── codeFormats/
│   │   │   ├── jsonFormatter.js
│   │   │   ├── yamlFormatter.js
│   │   │   ├── xmlFormatter.js
│   │   │   ├── tomlFormatter.js
│   │   │   └── iniFormatter.js
│   │   ├── markdownFormatter.js
│   │   ├── htmlFormatter.js
│   │   ├── csvFormatter.js
│   │   └── index.js
│   ├── services/
│   │   ├── llm.js
│   │   ├── scraper.js
│   │   └── transcriber.js
│   ├── utils/
│   │   ├── fileTypeDetector.js
│   │   ├── helpers.js
│   │   ├── promptLoader.js
│   │   ├── logger.js
│   │   └── errorHandler.js
│   ├── config/
│   │   └── prompts.yaml
│   └── api/
│       ├── routes/
│       │   ├── upload.js
│       │   ├── process.js
│       │   └── download.js
│       └── middlewares/
│           ├── auth.js
│           └── errorHandler.js
├── uploads/
├── .env
├── .gitignore
├── index.js
├── package.json
└── README.md
```

### 2.2. Detailed Folder and File Descriptions

#### `backend/processed/`

- **Purpose:** Stores all processed files after conversion or enhancement. This directory organizes output files based on their processing status and type.

#### `backend/src/`

This is the main source directory containing all the core logic and functionalities of the backend.

##### `inputProcessors/`

- **Purpose:** Contains modules responsible for handling and processing different types of input files.
- **Files:**

  - **`textProcessor.js`**

    - **Function:** Processes plain text files, performing tasks like cleaning, normalization, and preliminary analysis.
  - **`docxProcessor.js`**

    - **Function:** Handles `.docx` files, extracting text and metadata, and preparing them for further processing.
  - **`pdfProcessor.js`**

    - **Function:** Processes PDF files by extracting text content and relevant metadata using libraries like `pdf-parse`.
  - **`audioProcessor.js`**

    - **Function:** Manages audio file processing, including transcription using services like OpenAI's Whisper API.
  - **`videoProcessor.js`**

    - **Function:** Handles video files by extracting audio streams and transcribing them into text.
  - **`imageProcessor.js`**

    - **Function:** Processes image files, sending them to OpenAI's vision model to create alt text for.
  - **`index.js`**

    - **Function:** Acts as an aggregator, exporting all individual processors for easy import elsewhere in the application.

##### `enhancers/`

- **Purpose:** Enhances the extracted or transcribed content by generating metadata, summaries, and performing other enrichment tasks.
- **Files:**

  - **`textEnhancer.js`**

    - **Function:** Specifically enhances text-based content by generating metadata and concise summaries using language models.
  - **`imageEnhancer.js`**

    - **Function:** Enhances image content by generating alt text.
  - **`enhancerInterface.js`**

    - **Function:** Defines a base interface that all enhancers must implement, ensuring consistency across different enhancers.
  - **`index.js`**

    - **Function:** Aggregates and exports all enhancer modules for streamlined imports.

##### `outputFormatters/`

- **Purpose:** Converts processed and enhanced data into various output formats as specified by the user.
- **Files:**

  - **`documentFormats/`**

    - **`pdfFormatter.js`**
      - **Function:** Formats data into PDF documents.
    - **`docxFormatter.js`**
      - **Function:** Formats data into DOCX (Microsoft Word) documents.
    - **`txtFormatter.js`**
      - **Function:** Formats data into plain text files.
  - **`codeFormats/`**

    - **`jsonFormatter.js`**
      - **Function:** Outputs data in JSON format.
    - **`yamlFormatter.js`**
      - **Function:** Outputs data in YAML format.
    - **`xmlFormatter.js`**
      - **Function:** Outputs data in XML format.
    - **`tomlFormatter.js`**
      - **Function:** Outputs data in TOML format.
    - **`iniFormatter.js`**
      - **Function:** Outputs data in INI format.
  - **Other Formatters:**

    - **`markdownFormatter.js`**
      - **Function:** Formats data into Markdown files.
    - **`htmlFormatter.js`**
      - **Function:** Formats data into HTML files.
    - **`csvFormatter.js`**
      - **Function:** Formats data into CSV files.
  - **`index.js`**

    - **Function:** Aggregates and exports all formatter modules for easy access.

##### `services/`

- **Purpose:** Integrates external services and APIs that the backend interacts with, such as language models, scrapers, and transcribers.
- **Files:**

  - **`llm.js`**

    - **Function:** Manages interactions with Language Learning Models (LLMs) like OpenAI's GPT, handling prompt configurations and API calls.
  - **`scraper.js`**

    - **Function:** Handles web scraping functionalities, including scraping website content and retrieving YouTube transcripts.
  - **`transcriber.js`**

    - **Function:** Manages audio and video transcription services, converting media files into text using APIs like OpenAI's Whisper.

##### `utils/`

- **Purpose:** Provides utility functions and helpers that support various backend operations.
- **Files:**

  - **`fileTypeDetector.js`**

    - **Function:** Detects the type of a given file based on its content or extension, ensuring appropriate processing.
  - **`helpers.js`**

    - **Function:** Contains miscellaneous helper functions used across different modules.
  - **`promptLoader.js`**

    - **Function:** Loads and parses prompt configurations from YAML or other configuration files, facilitating dynamic prompt management.
  - **`logger.js`**

    - **Function:** Sets up and configures logging mechanisms using libraries like Winston, enabling structured and leveled logging.
  - **`errorHandler.js`**

    - **Function:** Centralizes error handling, ensuring consistent responses and logging for errors throughout the backend.

##### `config/`

- **Purpose:** Stores configuration files that dictate the behavior of the backend, including default settings and prompt templates.
  - **`prompts.yaml`**

    - **Function:** Defines prompt templates and configurations for interacting with LLMs, enabling dynamic and customizable prompt management.

##### `api/`

- **Purpose:** Defines the API layer of the backend, including routes and middleware for handling HTTP requests and enforcing security.
- **Folders:**

  - **`routes/`**

    - **`upload.js`**
      - **Function:** Handles file upload endpoints, managing the reception and initial processing of uploaded files.
    - **`process.js`**
      - **Function:** Manages processing endpoints, orchestrating the flow from input processing to enhancement and formatting.
    - **`download.js`**
      - **Function:** Handles endpoints for downloading processed files in desired formats.
  - **`middlewares/`**

    - **`auth.js`**
      - **Function:** Implements authentication middleware using JWT, securing protected API routes. (not written yet)
    - **`errorHandler.js`**
      - **Function:** Provides middleware for centralized error handling, ensuring consistent error responses.

#### Other Backend Files

- **`uploads/`**

  - **Purpose:** Serves as the storage directory for all uploaded files awaiting processing. Organizes files based on user uploads and processing status.
- **`.env`**

  - **Purpose:** Stores environment variables such as API keys, database credentials, and configuration settings. Ensures sensitive information is kept secure and separate from the codebase.
- **`.gitignore`**

  - **Purpose:** Specifies intentionally untracked files to ignore in Git repositories, preventing sensitive or unnecessary files from being committed.
- **`index.js`**

  - **Purpose:** Acts as the entry point for the backend application, initializing the server, connecting to databases, and setting up middleware and routes.
- **`package.json`**

  - **Purpose:** Manages project dependencies, scripts, and metadata. Defines the backend's package configurations and scripts for development, testing, and deployment.
- **`README.md`**

  - **Purpose:** Provides an overview of the backend project, including setup instructions, usage guidelines, and other relevant information for developers.

---

# Omni-Converter Frontend Documentation

## 1. Overview

The Omni-Converter frontend provides an intuitive, single-page user interface for file conversion and URL processing. It allows users to upload files, input URLs, select output formats, and initiate the conversion process.

## 2. Folder Structure

```
frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── Button.js
│   │   ├── Input.js
│   │   ├── FileInput.js
│   │   └── ProgressBar.js
│   ├── styles/
│   │   └── GlobalStyles.js
│   ├── utils/
│   │   └── api.js
│   ├── App.js
│   └── index.js
├── .gitignore
├── .env
└── package.json
```

## 3. Component Descriptions

### 3.1. App.js

The main component that composes the entire application UI.

**Key Features:**
- Displays the logo and title
- Provides a collapsible "How to Use" instructions section
- Includes an input for the OpenAI API key
- Offers a drag-and-drop area for file uploads
- Allows URL input with an add button
- Displays a list of uploaded files and added URLs
- Presents a grid of output format options
- Shows a conversion button and progress bar
- Displays conversion results and a download button upon completion

### 3.2. Button.js

A reusable button component with consistent styling.

### 3.3. Input.js

A reusable input component for text and URL inputs.

### 3.4. FileInput.js

A hidden file input component that works in conjunction with the drag-and-drop area.

### 3.5. ProgressBar.js

A component to visually represent the progress of the conversion process.

## 4. Styling

### 4.1. GlobalStyles.js

Contains global styles and CSS variables for consistent theming across the application.

## 5. Utilities

### 5.1. api.js

Manages API calls to the backend for file conversion and processing.

## 6. Key Files

### 6.1. index.js

The entry point of the React application, responsible for rendering the App component.

### 6.2. .env

Stores environment variables such as API endpoints.

### 6.3. package.json

Manages project dependencies and scripts.

## 7. User Flow

1. User enters their OpenAI API key
2. User uploads files via drag-and-drop or click-to-upload
3. User can add URLs if needed
4. User selects the desired output format
5. User initiates conversion by clicking the "Convert" button
6. Progress is displayed during processing
7. Upon completion, user can download the converted files as a ZIP

## 8. Key Features

- Single-page application design
- Drag-and-drop file upload
- URL input for processing web content
- Multiple output format options
- Real-time conversion progress display
- Responsive design for various screen sizes

## 4. Shared Utilities

The **Shared** directory contains utilities and helpers that are used across both the backend and frontend, promoting code reuse and consistency.

### 4.1. Folder Hierarchy

```
shared/
└── utils/
    ├── validation.js
    └── formatting.js
```

### 4.2. Detailed Folder and File Descriptions

#### `shared/utils/`

- **Purpose:** Offers common utility functions that can be leveraged by both backend and frontend components, reducing redundancy and enhancing maintainability.
- **Files:**

  - **`validation.js`**

    - **Function:** Contains functions for validating data, such as form inputs or API request payloads. Ensures that data meets specified criteria before processing.
  - **`formatting.js`**

    - **Function:** Provides functions for formatting data consistently across the application, such as formatting dates, numbers, or transforming data structures for display.

---

## 5. Root-Level Files

These files reside at the top level of the project and serve various foundational roles for both the backend and frontend components.

- **`.gitignore`**

  - **Purpose:** Specifies files and directories that Git should ignore, such as `node_modules/`, `logs/`, `.env` files, and build artifacts. Prevents sensitive or unnecessary files from being committed to version control.
- **`docker-compose.yml`**

  - **Purpose:** Defines multi-container Docker applications, orchestrating services like the backend server, frontend client, databases, and other dependencies. Facilitates easy setup and deployment of the entire application stack.
- **`README.md`**

  - **Purpose:** Provides a comprehensive overview of the entire project, including setup instructions, project goals, technologies used, and contribution guidelines. Acts as the primary documentation hub for developers and stakeholders.
- **`package.json`**

  - **Purpose:** While both backend and frontend have their own `package.json` files, the root `package.json` can manage shared scripts or dependencies if necessary. It might also serve as a monorepo configuration if the project uses tools like Lerna or Yarn Workspaces.

---

## 6. Additional Resources

For further information and in-depth guidance on specific components, refer to the following:

- **API Documentation:** Detailed specifications of all API endpoints, including request formats, parameters, and response structures.
- **Developer Guides:** Tutorials and walkthroughs for setting up the development environment, contributing to the project, and understanding core functionalities.
- **Architecture Diagrams:** Visual representations of the system's architecture, illustrating interactions between different components and services.
- **Testing Reports:** Documentation of testing strategies, coverage reports, and instructions for running tests.

---

# Conclusion

This documentation provides a structured overview of the **Omni-Converter** project's folder hierarchy and the roles of each directory and file within the broader application. By adhering to this organizational structure, the project ensures modularity, scalability, and maintainability, facilitating efficient development and collaboration.

For any further assistance or queries, please refer to the individual `README.md` files within the **backend** and **frontend** directories or reach out to the project maintainers.

---

*Happy Coding!*
