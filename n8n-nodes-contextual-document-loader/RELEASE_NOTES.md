# Release Notes

## v0.3.0 - Direct Document Processing

### Bug Fixes

- Fixed "processedDocuments.map is not a function" error when connecting to vector stores
- Changed implementation to process documents directly in `supplyData` method
- Removed intermediate processor object pattern that was incompatible with n8n's vector stores
- Documents are now returned directly as an array in the response

### Technical Details

The supplyData method now:
1. Gets all input items using `this.getInputData()`
2. Processes each item immediately to extract text and generate contextual chunks
3. Returns documents directly as `{ response: documents }` where documents is an array of Document objects
4. This matches the pattern expected by n8n's vector store nodes (Simple Vector Store, Supabase Vector Store, etc.)

### Breaking Changes

- Removed the `ContextualDocumentProcessor` class
- Removed dependency on `logWrapper` utility
- The node now processes documents synchronously within the `supplyData` method

## v0.2.9 - Align logWrapper with n8n core

### Bug Fixes

- Made `logWrapper` a true pass-through that simply returns the processor object, matching n8n's internal implementation.
- Ensures compatibility with vector-store nodes and prevents `processedDocuments.map is not a function` error.

## v0.2.8 - Fix logWrapper Implementation

### Bug Fixes

- Fixed "processedDocuments.map is not a function" error
- Implemented proper logWrapper that returns a function expected by n8n's vector stores
- The logWrapper now correctly wraps the processor and provides the interface that vector stores expect
- Fixed the data flow between the document loader and vector stores

### Technical Details

The logWrapper now:
1. Returns a function that will be called by the vector store
2. Gets input data from the workflow context using `context.getInputData()`
3. Passes the data to the processor's `processAll` method
4. Returns the processed documents to the vector store

This implementation matches the pattern used by n8n's Default Data Loader and ensures compatibility with all vector stores.

## v0.2.7 - Processor Class Implementation

### Bug Fixes

- Fixed "processedDocuments.map is not a function" error
- Implemented a proper processor class (ContextualDocumentProcessor) following n8n's pattern
- Added logWrapper utility to match n8n's document loader implementation
- The processor class properly implements processAll and processItem methods

### Technical Details

The implementation now:
1. Uses a dedicated ContextualDocumentProcessor class
2. Wraps the processor with logWrapper (simplified version)
3. Follows the exact pattern from n8n's N8nJsonLoader and N8nBinaryLoader
4. Should be fully compatible with all vector stores

## v0.2.6 - Processor Pattern Implementation

### Bug Fixes

- Fixed "no output" issue by implementing the correct processor pattern
- Changed from returning documents directly to returning a processor object with `processAll` and `processItem` methods
- This matches the pattern used by n8n's Default Data Loader and other document loaders
- The vector store now correctly calls the processor methods with input data

### Technical Details

The supplyData method now returns a processor object that:
1. Has `processAll` method that processes all input items
2. Has `processItem` method that processes individual items
3. Extracts text from various fields (text, content, document, data)
4. Generates contextual chunks using the connected LLM and text splitter

This implementation follows the exact pattern from n8n's Default Data Loader source code.

## v0.2.5 - Direct Document Return

### Bug Fixes

- Fixed "processedDocuments.map is not a function" error
- Changed implementation to return documents directly instead of a processor object
- The node now processes all input items and returns an array of Document objects
- This matches how n8n's vector stores expect document loaders to work

### Technical Details

The supplyData method now:
1. Gets all input items using `this.getInputData()`
2. Processes each item to extract text and generate contextual chunks
3. Returns documents directly as `{ response: documents }`

## v0.2.4 - Fix Document Loader Pattern

### Bug Fixes

- Fixed "processedDocuments.map is not a function" error
- Implemented proper document loader pattern with processItem method
- The node now returns a loader object with processItem function that vector stores expect
- Changed from returning a document processing function to returning a loader object

### Technical Details

The supplyData method now returns an object with:
- `response.processItem`: A method that takes an item and returns Document[]
- This matches the pattern that n8n's vector stores expect from document loaders

## v0.2.3 - Fix Document Processing

### Bug Fixes

- Fixed "no output" issue by implementing proper document processor pattern
- The node now returns a processing function that vector stores can use
- Changed from returning documents directly to returning a document processor
- This matches how n8n's Default Data Loader and other document loaders work

### Technical Details

The supplyData method now returns a function that:
1. Takes documents as input (from the vector store)
2. Processes them with contextual retrieval
3. Returns the enhanced documents

This is the standard pattern that vector stores expect from document loaders.

## v0.2.2 - Fix Data Flow

### Bug Fixes

- Fixed "no output" issue by removing main input requirement
- The node now properly receives data from the parent vector store node
- Adjusted parameter indexing to work correctly as a sub-node

### How It Works

The Contextual Document Loader is a sub-node that:
1. Receives data from the vector store's main input
2. Processes it with contextual retrieval
3. Passes the enhanced documents to the vector store

No direct main input connection is needed to the Contextual Document Loader.

## v0.2.1 - Bug Fix

### Bug Fixes

- Fixed "Node does not have a `supplyData` method defined" error
- The node now properly implements the `supplyData` method required for LangChain sub-nodes
- Changed from `execute` to `supplyData` for proper integration with vector stores and other AI nodes

## v0.2.0 - Major Refactor

### Breaking Changes

- Node now requires a Text Splitter input connection instead of defining text splitters internally
- Removed 'Enable Contextual Retrieval' option - the node is now specifically for contextual retrieval
- Chat Model input is now required

### New Features

- Uses any n8n text splitter node via input connection
- Simplified prompt handling - automatically provides document and chunk to LLM
- Context prompt is now a main parameter (not hidden in options)
- Cleaner, more focused implementation

### Migration Guide

If upgrading from v0.1.0:
1. Add a Text Splitter node (e.g., Recursive Character Text Splitter) to your workflow
2. Connect it to the Contextual Document Loader's Text Splitter input
3. Remove any text splitter configuration from the node itself
4. The context prompt no longer needs {{WHOLE_DOCUMENT}} and {{CHUNK_CONTENT}} placeholders

## v0.1.0 - Initial Release

- Initial implementation of Contextual Document Loader
- Support for contextual retrieval using Anthropic's technique
- Built-in text splitters
- Configurable context generation 