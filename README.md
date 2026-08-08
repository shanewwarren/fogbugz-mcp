# FogBugz MCP Server

A Model Context Protocol (MCP) server for interacting with FogBugz through Language Learning Models (LLMs) such as Claude.

## Overview

This server allows LLMs to perform various operations on FogBugz including:

- Creating new issues/cases with optional attachments
- Updating existing cases (project, area, milestone, priority, assignee, tags, due date)
- Reading a single case in full, including its complete event history
- Adding comments to a case
- Assigning cases to specific users
- Resolving, closing, and reopening cases
- Listing a user's open cases
- Getting direct links to specific cases
- Searching for cases by various criteria, with caller-selected columns
- Listing metadata: people, projects, areas, milestones, priorities, statuses, categories

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
- `fogbugz_add_comment` - Add a comment without changing other fields
- `fogbugz_assign_case` - Assign a case to a specific user
- `fogbugz_resolve_case` - Resolve a case, optionally into a named status
- `fogbugz_close_case` - Close a case
- `fogbugz_reopen_case` - Reopen a resolved or closed case
- `fogbugz_get_case` - Get one case in full, with its event history
- `fogbugz_list_my_cases` - List cases assigned to a specific user
- `fogbugz_search_cases` - Search for cases using a query string
- `fogbugz_list_metadata` - List people, projects, areas, milestones, priorities, statuses, or categories
- `fogbugz_get_case_link` - Get a direct link to a specific case
- `fogbugz_create_project` - Create a new project

## Columns and silent drops

FogBugz **silently ignores `cols` names it does not recognize** — no error, no
warning, the key is simply missing from the response, so a typo is
indistinguishable from an empty value. This server validates requested columns
against `src/api/columns.ts` and rejects unknown ones with the list of valid
names. Custom fields prefixed `plugin_` are allowed through unchecked.

That allowlist was built by probing a live instance one column at a time, not by
reading the docs. Two documented names are **not** honored and are therefore
absent: `latestEvent` and `sPersonOpenedBy` (use `ixPersonOpenedBy`).

The same silent-acceptance behavior affects writes: an instance with time
tracking disabled accepts `hrsCurrEst` and applies nothing. `fogbugz_update_case`
re-reads the case afterwards and returns a `warnings` array naming any field that
did not stick.

Two further corrections to `docs/`, both verified against a live instance:
the JSON API command is `listStatuses`, not the documented `listStatus` (which
returns "Error 27: No such API command"), and an event's `s` body is frequently
empty when the event only records a field change — the substance is in `sChanges`.

## License

ISC 