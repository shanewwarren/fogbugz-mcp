# Listing and Viewing Cases

## XML API

In the XML API, you can list and view cases using the `search` command:

```
http://www.example.com/api.asp?cmd=search&token=24dsg34lok43un23
```

You can use the following arguments:

- `q`: The query term you are searching for (string, case number, or comma-separated list of case numbers)
- `cols`: Comma-separated list of column names to return (e.g., `cols=sTitle,sStatus`)
- `max`: Maximum number of bugs to return

Response example:
```xml
<response>
  <cases count="1">
    <case ixBug="123" operations="edit,assign,resolve,reactivate,close,reopen">
      <ixBug>123</ixBug>
      <sTitle>Sample bug</sTitle>
      <sStatus>Active</sStatus>
      <!-- additional fields based on the cols parameter -->
    </case>
  </cases>
</response>
```

## JSON API Equivalent

The JSON API uses the same `search` command with a JSON request body:

### Basic Search (Current Filter)

#### Request

```json
{
  "cmd": "search",
  "token": "your_api_token"
}
```

#### Response

```json
{
  "data": {
    "count": 10,
    "totalHits": 25,
    "cases": [
      {
        "operations": [
          "edit",
          "assign",
          "resolve",
          "email"
        ],
        "ixBug": 18,
        "sTitle": "Sample bug title",
        "sStatus": "Active"
        // Additional fields depending on default columns
      },
      // More cases...
    ]
  },
  "errors": [],
  "warnings": []
}
```

### Search with Query Term

#### Request

```json
{
  "cmd": "search",
  "token": "your_api_token",
  "q": "status:\"Active\""
}
```

### Search with Specific Columns

#### Request

```json
{
  "cmd": "search",
  "token": "your_api_token",
  "q": "status:\"Active\"",
  "cols": ["ixBug", "sTitle", "sStatus", "sPriority", "sProject"]
}
```

### Search with Maximum Results

#### Request

```json
{
  "cmd": "search",
  "token": "your_api_token",
  "q": "status:\"Active\"",
  "cols": ["ixBug", "sTitle"],
  "max": 2
}
```

### Search for a Specific Case

#### Request

```json
{
  "cmd": "search",
  "token": "your_api_token",
  "q": "123",  // Case number
  "cols": ["ixBug", "sTitle", "sStatus", "events"]
}
```

## Available Columns

Many columns are available, including:

- `ixBug`: Case number
- `sTitle`: Case title
- `sStatus`: Status name
- `ixStatus`: Status ID
- `sPriority`: Priority name
- `ixPriority`: Priority ID
- `sProject`: Project name
- `ixProject`: Project ID
- `sArea`: Area name
- `ixArea`: Area ID
- `sFixFor`: Milestone name
- `ixFixFor`: Milestone ID
- `sPersonAssignedTo`: Person the case is assigned to
- `ixPersonAssignedTo`: Person ID the case is assigned to
- `events`: All events for the case
- `tags`: Tags associated with the case

> **Verified against a live instance.** FogBugz silently drops column names it
> does not recognize -- no error, no warning, the key is simply absent. Two names
> that appear in FogBugz's own documentation are **not** honored by the JSON API:
> `latestEvent` and `sPersonOpenedBy` (use `ixPersonOpenedBy`). The authoritative
> list of columns this server accepts lives in `src/api/columns.ts`.

## Events in Results

When including `events` in the `cols` parameter, you'll receive detailed event information:

```json
"events": [
  {
    "ixBugEvent": 174,
    "ixBug": 13,
    "evt": 4,
    "sVerb": "Assigned to Jane Smith",
    "ixPerson": 3,
    "sPerson": "John Doe",
    "ixPersonAssignedTo": 4,
    "dt": "2023-05-06T22:47:59Z",
    "s": "Working on this now",
    "sHTML": "<strong>Working on this now</strong>",
    "fEmail": false,
    "fExternal": false,
    "sFormat": "html",
    "sChanges": "Status changed from 'New' to 'In Progress'"
  },
  // Additional events...
]
```

There is no working "latest event only" column; fetch `events` and take the last
entry. Note that `s` is frequently empty on events that only record a field
change -- the substance is in `sChanges` in that case, so read both.

## Example with curl

```bash
# Search with query and specific columns
curl --location --request POST "https://example.fogbugz.com/f/api/0/jsonapi" \
--header 'Content-Type: application/json' \
--data-raw '{
    "cmd": "search",
    "token": "your_api_token",
    "q": "status:\"Active\"",
    "cols": ["ixBug", "sTitle", "sStatus", "sPriority", "sProject"],
    "max": 5
}'

# Get a specific case with events
curl --location --request POST "https://example.fogbugz.com/f/api/0/jsonapi" \
--header 'Content-Type: application/json' \
--data-raw '{
    "cmd": "search",
    "token": "your_api_token",
    "q": "123",
    "cols": ["ixBug", "sTitle", "sStatus", "events"]
}'
```

## Example with JavaScript

```javascript
const axios = require('axios');

// Search for cases with various parameters
async function searchCases(apiUrl, token, query = null, columns = null, maxResults = null) {
  try {
    const payload = {
      cmd: 'search',
      token: token
    };
    
    // Add optional parameters if provided
    if (query) payload.q = query;
    if (columns) payload.cols = columns;
    if (maxResults) payload.max = maxResults;
    
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data.cases;
  } catch (error) {
    console.error('Error searching cases:', error.response?.data || error.message);
    return null;
  }
}

// Example usage
async function fetchActiveCases() {
  const columns = ['ixBug', 'sTitle', 'sStatus', 'sPriority', 'sProject'];
  const cases = await searchCases(
    'https://example.fogbugz.com/f/api/0/jsonapi',
    'your_api_token',
    'status:"Active"',
    columns,
    10
  );
  
  console.log(`Found ${cases.length} active cases`);
  return cases;
}
```

## Notes

1. The JSON API uses the same `search` command as the XML API, but accepts a JSON payload for parameters.
2. Unlike the XML API which uses comma-separated strings for `cols`, the JSON API uses arrays: `"cols": ["sTitle", "sStatus"]`.
3. The `search` command functions both for listing multiple cases and viewing detailed information for a specific case.
4. To view a specific case, search for its case number and include the required columns.
5. The response includes an `operations` array listing the operations you can perform on each case.
6. For custom fields and plugin fields, refer to the FogBugz documentation on accessing those through the API.
