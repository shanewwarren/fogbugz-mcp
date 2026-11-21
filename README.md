# FogBugz MCP Server

A Model Context Protocol (MCP) server for interacting with FogBugz through Language Learning Models (LLMs) such as Claude.

## Overview

This server allows LLMs to perform various operations on FogBugz including:

- Creating new issues/cases with optional attachments
- Updating existing cases (changing project, area, milestone, priority)
- Assigning cases to specific users
- Listing a user's open cases
- Getting direct links to specific cases
- Searching for cases by various criteria
- Reading, creating, and editing wiki pages (from markdown), with image uploads

The server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) specification, allowing it to be used by any MCP-compatible LLM client.

## Project Background

This project was initiated with the help of [OpenAI's o3-mini-high model](https://openai.com/), which generated a comprehensive development plan (see DEVELOPMENT-PLAN.md in the repository). The plan outlined the architecture, tools, and implementation details for building a FogBugz MCP server in TypeScript.

The detailed specification served as a blueprint for the development team, demonstrating how AI can effectively assist in the early phases of project design and planning. This project is both an example of AI-assisted development and a tool that enhances AI capabilities through the MCP protocol.

## Installation

```bash
# Install from npm
npm install -g fogbugz-mcp

# Or use directly with npx
npx fogbugz-mcp <fogbugz-url> <api-key>
```

## Usage

### Basic Usage

```bash
# Run with command line arguments
fogbugz-mcp https://yourcompany.fogbugz.com your-api-key

# Or use environment variables
export FOGBUGZ_URL=https://yourcompany.fogbugz.com
export TEST_FOGBUGZ_API_KEY=your-api-key
fogbugz-mcp
```

### Development

```bash
# Clone the repository
git clone https://github.com/yourusername/fogbugz-mcp.git
cd fogbugz-mcp

# Install dependencies
npm install

# Create a .env file with your FogBugz credentials
echo "FOGBUGZ_URL=https://yourcompany.fogbugz.com" > .env
echo "TEST_FOGBUGZ_API_KEY=your-api-key" >> .env

# Run API explorer to test FogBugz API
npm run explore

# Run the development version of the server
npm run dev

# Run tests
npm test

# Build the project
npm run build
```

## API Explorer

The project includes an API explorer tool for testing FogBugz API endpoints directly:

```bash
# Run all API tests
npm run explore

# Run a specific test (by index)
npm run explore 0  # Run the first test
```

## MCP Tools

This server provides the following MCP tools for LLMs:

- `fogbugz_create_case` - Create a new FogBugz case
- `fogbugz_update_case` - Update an existing case's fields
- `fogbugz_assign_case` - Assign a case to a specific user
- `fogbugz_list_my_cases` - List cases assigned to a specific user
- `fogbugz_search_cases` - Search for cases using a query string
- `fogbugz_get_case_link` - Get a direct link to a specific case

### Wiki tools

- `fogbugz_list_wikis` - List wikis
- `fogbugz_list_wiki_articles` - List pages in one wiki, or search titles across all wikis
- `fogbugz_get_wiki_article` - Get a page's HTML body and current revision (ids: `184`, `"W184"`, or the page URL)
- `fogbugz_create_wiki_article` - Create a page from markdown (default) or HTML; a leading `# Title` becomes the page title
- `fogbugz_edit_wiki_article` - Replace a page's body/title/tags; `expectedRevision` refuses the edit if someone changed the page since you read it
- `fogbugz_list_wiki_revisions` - List a page's revision history
- `fogbugz_create_wiki` - Create a wiki
- `fogbugz_start_wiki_upload` - Get a presigned upload link + `curl` command for a local file (only listed when R2 staging is configured)
- `fogbugz_upload_wiki_file` - Attach a file to a wiki from an `uploadId`, `url`, `filePath`, or `base64`; returns an embeddable markdown snippet

The FogBugz API has no command to delete a wiki page.

#### Image uploads from remote clients

A remote MCP client cannot hand the server a local file, so uploads are staged in a Cloudflare R2 bucket: `fogbugz_start_wiki_upload` returns a 30-minute presigned PUT link (the client needs no credentials), the client runs the returned `curl`, and `fogbugz_upload_wiki_file { uploadId }` reads the file from R2, attaches it, and deletes the staged copy. Enable it with:

| Variable | Value |
|----------|-------|
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_BUCKET` | Bucket for staged uploads (objects go under `uploads/wiki/`; add a lifecycle rule to expire leftovers) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 API token with Object Read & Write on that bucket |

## License

ISC 