# Lists

## XML API

In the XML API, several commands are available to list different types of entities in FogBugz:

- `listCases`: List all cases
- `listProjects`: List all undeleted projects
- `listAreas`: List all undeleted areas
- `listCategories`: List all categories
- `listPriorities`: List all priorities
- `listPeople`: List people in the system
- `listStatuses`: List all status values (the XML API's `listStatus` is **not** accepted by the JSON API -- it returns "Error 27: No such API command")
- `listFixFors`: List milestones
- `listMailboxes`: List accessible mailboxes
- `listWikis`: List wikis
- `listTemplates`: List wiki templates
- `listSnippets`: List snippets

## JSON API Equivalent

The JSON API provides the same commands for listing FogBugz entities, with the same names but using a JSON request format.

### 1. List Projects

#### Request

```json
{
  "cmd": "listProjects",
  "token": "your_api_token",
  "fWrite": false,  // Optional: Set to true to only list projects you can write to
  "fIncludeDeleted": false  // Optional: Set to true to include deleted projects
}
```

#### Response

```json
{
  "data": {
    "projects": [
      {
        "ixProject": 1,
        "sProject": "Inbox",
        "ixPersonOwner": 2,
        "fInbox": true,
        "fDeleted": false
      },
      {
        "ixProject": 2,
        "sProject": "My Project",
        "ixPersonOwner": 2,
        "fInbox": false,
        "fDeleted": false
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 2. List Areas

#### Request

```json
{
  "cmd": "listAreas",
  "token": "your_api_token",
  "fWrite": false,  // Optional
  "ixProject": 2,   // Optional: Only list areas from this project
  "ixArea": 5       // Optional: Always list this area even if deleted
}
```

#### Response

```json
{
  "data": {
    "areas": [
      {
        "ixArea": 3,
        "sArea": "Frontend",
        "ixProject": 2,
        "ixPersonOwner": 5,
        "nType": 0,
        "cDoc": 0,
        "fDeleted": false
      },
      {
        "ixArea": 4,
        "sArea": "Backend",
        "ixProject": 2,
        "ixPersonOwner": 4,
        "nType": 0,
        "cDoc": 0,
        "fDeleted": false
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 3. List Categories

#### Request

```json
{
  "cmd": "listCategories",
  "token": "your_api_token"
}
```

#### Response

```json
{
  "data": {
    "categories": [
      {
        "ixCategory": 1,
        "sCategory": "Bug",
        "sPlural": "Bugs",
        "ixStatusDefault": 2,
        "fIsScheduleItem": false
      },
      {
        "ixCategory": 2,
        "sCategory": "Feature",
        "sPlural": "Features",
        "ixStatusDefault": 8,
        "fIsScheduleItem": false
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 4. List Priorities

#### Request

```json
{
  "cmd": "listPriorities",
  "token": "your_api_token"
}
```

#### Response

```json
{
  "data": {
    "priorities": [
      {
        "ixPriority": 1,
        "sPriority": "Must Fix"
      },
      {
        "ixPriority": 2,
        "sPriority": "Should Fix"
      },
      {
        "ixPriority": 3,
        "sPriority": "Fix If Time"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 5. List People

#### Request

```json
{
  "cmd": "listPeople",
  "token": "your_api_token",
  "fIncludeActive": true,   // Default: true
  "fIncludeNormal": true,   // Default: true
  "fIncludeDeleted": false, // Default: false
  "fIncludeCommunity": false, // Default: false
  "fIncludeVirtual": false  // Default: false
}
```

#### Response

```json
{
  "data": {
    "people": [
      {
        "ixPerson": 2,
        "sFullName": "Administrator",
        "sEmail": "admin@example.com",
        "fAdministrator": true,
        "fCommunity": false,
        "fVirtual": false,
        "fDeleted": false,
        "fNotify": true
      },
      {
        "ixPerson": 3,
        "sFullName": "Jane Smith",
        "sEmail": "jane@example.com",
        "fAdministrator": false,
        "fCommunity": false,
        "fVirtual": false,
        "fDeleted": false,
        "fNotify": true
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 6. List Status

#### Request

```json
{
  "cmd": "listStatuses",
  "token": "your_api_token",
  "ixCategory": 1,  // Optional: Limit results to statuses within this category
  "fResolved": false // Optional: Set to true to only include resolved statuses
}
```

#### Response

```json
{
  "data": {
    "statuses": [
      {
        "ixStatus": 1,
        "sStatus": "Active",
        "ixCategory": 1,
        "fWorkDone": false,
        "fResolved": false,
        "fDuplicate": false,
        "fDeleted": false,
        "iOrder": 0
      },
      {
        "ixStatus": 2,
        "sStatus": "Resolved (Fixed)",
        "ixCategory": 1,
        "fWorkDone": true,
        "fResolved": true,
        "fDuplicate": false,
        "fDeleted": false,
        "iOrder": 0
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 7. List Milestones (FixFors)

#### Request

```json
{
  "cmd": "listFixFors",
  "token": "your_api_token",
  "ixProject": 2,   // Optional: Only list milestones for this project
  "ixFixFor": 3,    // Optional: Include this milestone even if unassignable
  "fIncludeDeleted": false, // Optional: Include inactive milestones
  "fIncludeReallyDeleted": false // Optional: Include completely deleted milestones
}
```

#### Response

```json
{
  "data": {
    "fixfors": [
      {
        "ixFixFor": 1,
        "sFixFor": "Undecided",
        "fDeleted": false,
        "dt": null,
        "dtStart": null,
        "sStartNote": null,
        "ixProject": null,
        "sProject": null
      },
      {
        "ixFixFor": 2,
        "sFixFor": "Version 2.0",
        "fDeleted": false,
        "dt": "2023-12-31T00:00:00Z",
        "dtStart": "2023-09-01T00:00:00Z",
        "sStartNote": "Development begins after resources are available",
        "ixProject": 2,
        "sProject": "My Project"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### 8. Other List Commands

#### List Mailboxes

```json
{
  "cmd": "listMailboxes",
  "token": "your_api_token"
}
```

#### List Wikis

```json
{
  "cmd": "listWikis",
  "token": "your_api_token"
}
```

#### List Wiki Templates

```json
{
  "cmd": "listTemplates",
  "token": "your_api_token"
}
```

#### List Snippets

```json
{
  "cmd": "listSnippets",
  "token": "your_api_token",
  "fGlobalOnly": false // Optional: Set to true to return only global snippets
}
```

## Example with curl

```bash
# List all projects
curl --location --request POST "https://example.fogbugz.com/f/api/0/jsonapi" \
--header 'Content-Type: application/json' \
--data-raw '{
    "cmd": "listProjects",
    "token": "your_api_token"
}'

# List all people
curl --location --request POST "https://example.fogbugz.com/f/api/0/jsonapi" \
--header 'Content-Type: application/json' \
--data-raw '{
    "cmd": "listPeople",
    "token": "your_api_token",
    "fIncludeActive": true,
    "fIncludeDeleted": false
}'
```

## Example with JavaScript

```javascript
const axios = require('axios');

// List all projects
async function listProjects(apiUrl, token) {
  try {
    const response = await axios.post(apiUrl, {
      cmd: 'listProjects',
      token: token
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data.projects;
  } catch (error) {
    console.error('Error listing projects:', error.response?.data || error.message);
    return null;
  }
}

// List areas for a specific project
async function listAreasForProject(apiUrl, token, projectId) {
  try {
    const response = await axios.post(apiUrl, {
      cmd: 'listAreas',
      token: token,
      ixProject: projectId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data.areas;
  } catch (error) {
    console.error('Error listing areas:', error.response?.data || error.message);
    return null;
  }
}

// Generic function to list any entity type
async function listEntities(apiUrl, token, entityType, params = {}) {
  try {
    const cmdMap = {
      'projects': 'listProjects',
      'areas': 'listAreas',
      'categories': 'listCategories',
      'priorities': 'listPriorities',
      'people': 'listPeople',
      'statuses': 'listStatuses',
      'milestones': 'listFixFors',
      'mailboxes': 'listMailboxes',
      'wikis': 'listWikis',
      'templates': 'listTemplates',
      'snippets': 'listSnippets'
    };
    
    if (!cmdMap[entityType]) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    const response = await axios.post(apiUrl, {
      cmd: cmdMap[entityType],
      token: token,
      ...params
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Most responses have the entity type as the property name
    // but some have special names, like fixfors for milestones
    const responsePropertyMap = {
      'milestones': 'fixfors',
      'statuses': 'statuses'
    };
    
    const propertyName = responsePropertyMap[entityType] || entityType;
    return response.data.data[propertyName];
  } catch (error) {
    console.error(`Error listing ${entityType}:`, error.response?.data || error.message);
    return null;
  }
}
```

## Notes

1. The JSON API provides the same list commands as the XML API but returns JSON responses.
2. Boolean parameters use true/false values rather than 0/1 as in the XML API.
3. Optional parameters can be omitted if not needed.
4. The JSON responses follow a consistent structure with a `data` object containing the main response.
5. Error messages and warnings are returned in the `errors` and `warnings` arrays.
6. For better performance, consider filtering results on the server side using optional parameters.
7. The `listCases` command is similar to the `search` command but with different parameters.
