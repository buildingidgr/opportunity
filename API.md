# Opportunity Service API Documentation

## Overview
This service manages opportunities through a RESTful API. It provides endpoints for retrieving, updating, and tracking changes to opportunities.

## Base URL
The service is deployed on Railway platform. Use your Railway-provided URL as the base URL.

## Authentication
All endpoints (except health check) require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer your-jwt-token
```

The token must be validated with the Auth Service at:
```
POST https://auth-service-production-16ee.up.railway.app/v1/token/validate
```

## Endpoints

### 1. Health Check
```http
GET /
```

Checks if the service is operational. This is the only endpoint that doesn't require authentication.

**Response (200 OK)**
```json
{
    "status": "healthy",
    "timestamp": "2023-12-20T10:00:00.000Z"
}
```

### 2. Get Public Opportunities
```http
GET /opportunities
```

Retrieves a paginated list of public opportunities. Sensitive data (contact information, exact location) is automatically masked.

**Authentication Required**: Yes

**Query Parameters**
| Parameter  | Type    | Required | Default | Max  | Description                    |
|------------|---------|----------|---------|------|--------------------------------|
| page       | integer | No       | 1       | -    | Page number                    |
| limit      | integer | No       | 10      | 50   | Items per page                 |
| category   | string  | No       | -       | -    | Filter by project category     |

**Success Response (200 OK)**
```json
{
    "opportunities": [
        {
            "_id": "6761e3f3a2bf30a81b20906e",
            "type": "opportunity.created",
            "data": {
                "project": {
                    "category": {
                        "title": "Τεχνικά Έργα & Υποδομές",
                        "description": "Technical Works & Infrastructure"
                    },
                    "location": {
                        "address": "Generated random address",
                        "coordinates": {
                            "lat": 40.6823,  // Randomized within 5km
                            "lng": 21.6498   // Randomized within 5km
                        }
                    },
                    "details": {
                        "description": "Project description",
                        "requirements": "Project requirements"
                    }
                },
                "contact": {
                    "fullName": "Generated random name",
                    "email": "Generated random email",
                    "phone": {
                        "countryCode": "+00",
                        "number": "Generated random phone"
                    }
                },
                "metadata": {
                    "submittedAt": "2024-12-17T14:00:11.151Z",
                    "locale": "el-GR",
                    "source": "web_form",
                    "version": "1.0.0"
                }
            },
            "status": "public",
            "lastStatusChange": {
                "from": "in review",
                "to": "public",
                "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
                "changedAt": "2023-12-20T15:30:45.123Z"
            }
        }
    ],
    "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 48,
        "itemsPerPage": 10,
        "hasNextPage": true,
        "hasPreviousPage": false
    },
    "filter": {
        "category": "all",
        "appliedQuery": {
            "status": "public"
        }
    }
}
```

**Error Responses**

*400 Bad Request*
```json
{
    "error": "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 50"
}
```

*401 Unauthorized*
```json
{
    "error": "Authorization header missing or invalid"
}
```

### 3. Get Single Opportunity
```http
GET /opportunities/:id
```

Retrieves a specific opportunity by its MongoDB ObjectId. For public opportunities, sensitive data (location and contact information) is masked. For non-public opportunities (in review, private, rejected), the complete unmasked data is returned.

**Authentication Required**: Yes

**URL Parameters**
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| id        | string | Yes      | MongoDB ObjectId of opportunity|

**Success Response (200 OK) - Public Opportunity**
```json
{
    "_id": "6761e3f3a2bf30a81b20906e",
    "type": "opportunity.created",
    "data": {
        "project": {
            "category": {
                "title": "Τεχνικά Έργα & Υποδομές",
                "description": "Technical Works & Infrastructure"
            },
            "location": {
                "address": "Generated random address",
                "coordinates": {
                    "lat": 40.6823,  // Randomized within 3km
                    "lng": 21.6498   // Randomized within 3km
                }
            },
            "details": {
                "description": "Detailed project description",
                "requirements": "Project requirements"
            }
        },
        "contact": {
            "fullName": "Generated random name",
            "email": "Generated random email",
            "phone": {
                "countryCode": "+00",
                "number": "Generated random phone"
            }
        }
    },
    "status": "public",
    "lastStatusChange": {
        "from": "in review",
        "to": "public",
        "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
        "changedAt": "2023-12-20T15:30:45.123Z"
    },
    "statusHistory": [
        {
            "from": "in review",
            "to": "public",
            "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
            "changedAt": "2023-12-20T15:30:45.123Z"
        }
    ]
}
```

**Success Response (200 OK) - Non-Public Opportunity**
```json
{
    "_id": "6761e3f3a2bf30a81b20906e",
    "type": "opportunity.created",
    "data": {
        "project": {
            "category": {
                "title": "Τεχνικά Έργα & Υποδομές",
                "description": "Technical Works & Infrastructure"
            },
            "location": {
                "address": "123 Main Street, Athens",
                "coordinates": {
                    "lat": 40.6823,
                    "lng": 21.6498
                }
            },
            "details": {
                "description": "Detailed project description",
                "requirements": "Project requirements"
            }
        },
        "contact": {
            "fullName": "John Doe",
            "email": "john@example.com",
            "phone": {
                "countryCode": "+30",
                "number": "2101234567"
            }
        }
    },
    "status": "in review",  // or "private" or "rejected"
    "lastStatusChange": {
        "from": "rejected",
        "to": "in review",
        "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
        "changedAt": "2023-12-20T15:30:45.123Z"
    },
    "statusHistory": [
        {
            "from": "rejected",
            "to": "in review",
            "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
            "changedAt": "2023-12-20T15:30:45.123Z"
        }
    ]
}
```

**Error Responses**

*400 Bad Request*
```json
{
    "error": "Invalid ID format"
}
```

*404 Not Found*
```json
{
    "error": "Opportunity not found"
}
```

### 4. Update Opportunity Status
```http
PATCH /opportunities/:id/status
```

Updates the status of an opportunity. Status changes are tracked with user information and timestamps.

**Authentication Required**: Yes

**URL Parameters**
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| id        | string | Yes      | MongoDB ObjectId of opportunity|

**Request Body**
```json
{
    "status": "public"
}
```

**Status Transition Rules**
| Current Status | Allowed Transitions    |
|----------------|------------------------|
| in review      | public, rejected      |
| public         | private               |
| private        | none                  |
| rejected       | in review             |

**Success Response (200 OK)**
```json
{
    "message": "Status updated successfully",
    "statusChange": {
        "previousStatus": "in review",
        "newStatus": "public",
        "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
        "changedAt": "2023-12-20T15:30:45.123Z"
    }
}
```

**Error Responses**

*400 Bad Request - Invalid Status*
```json
{
    "error": "Invalid status. Allowed values: in review, public, private, rejected"
}
```

*400 Bad Request - Invalid Transition*
```json
{
    "error": "Cannot change status from 'private' to 'public'",
    "allowedTransitions": {
        "in review": ["public", "rejected"],
        "public": ["private"],
        "private": [],
        "rejected": ["in review"]
    }
}
```

### 5. Get Map Coordinates
```http
GET /opportunities/map-coordinates
```

Retrieves coordinates for all public opportunities, with locations masked within a 3km radius. Designed for map visualization.

**Authentication Required**: Yes

**Response (200 OK)**
```json
{
    "points": [
        {
            "id": "opportunity-id",
            "category": "Category Name",
            "coordinates": {
                "lat": 40.6823,
                "lng": 21.6498
            }
        }
    ],
    "metadata": {
        "totalPoints": 48,
        "maskingRadiusKm": 3,
        "timestamp": "2023-12-20T15:30:45.123Z"
    }
}
```

**Features**:
1. Returns only public opportunities with valid coordinates
2. Coordinates are masked within a 3km radius for privacy
3. Includes category information for map filtering/clustering
4. Coordinates are rounded to 4 decimal places (~11m precision)
5. Lightweight response optimized for map rendering

**Error Responses**

*401 Unauthorized*
```json
{
    "error": "Authorization header missing or invalid"
}
```

*500 Internal Server Error*
```json
{
    "error": "Internal server error",
    "details": "Error fetching map coordinates"
}
```

### 6. Get My Changed Opportunities
```http
GET /opportunities/my-changes
```

Retrieves opportunities where the authenticated user has made status changes. Only returns opportunities with current status "private".

**Authentication Required**: Yes

**Query Parameters**
| Parameter | Type    | Required | Default | Max | Description        |
|-----------|---------|----------|---------|-----|--------------------|
| page      | integer | No       | 1       | -   | Page number        |
| limit     | integer | No       | 10      | 50  | Items per page     |

**Success Response (200 OK)**
```json
{
    "opportunities": [
        {
            "_id": "6761e3f3a2bf30a81b20906e",
            "type": "opportunity.created",
            "data": {
                "project": {
                    "category": {
                        "title": "Τεχνικά Έργα & Υποδομές"
                    },
                    "details": {
                        "description": "Project description"
                    }
                }
            },
            "currentStatus": "private",
            "myChanges": [
                {
                    "from": "public",
                    "to": "private",
                    "changedAt": "2023-12-20T15:30:45.123Z"
                }
            ],
            "totalChanges": 3,
            "myChangesCount": 1,
            "lastChange": {
                "from": "public",
                "to": "private",
                "changedBy": "user_2prIb6NUsyTjopaWeWDjFW8jdGY",
                "changedAt": "2023-12-20T15:30:45.123Z"
            }
        }
    ],
    "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 48,
        "itemsPerPage": 10,
        "hasNextPage": true,
        "hasPreviousPage": false
    },
    "summary": {
        "totalOpportunities": 48,
        "totalChanges": 96
    }
}
```

### 4. Get Opportunity Growth Statistics
```http
GET /opportunities/stats/growth
```

Retrieves statistics about the growth of public opportunities over time. This endpoint is designed to provide data compatible with chart visualization libraries, particularly shadcn/ui chart components.

**Authentication Required**: Yes

**Query Parameters**
| Parameter  | Type    | Required | Default | Description                                                |
|------------|---------|----------|---------|-------------------------------------------------------|
| interval   | string  | No       | weekly  | Time interval for grouping data (hourly/daily/weekly/monthly)|
| startDate  | string  | No       | 3 months ago | Start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ) |
| endDate    | string  | No       | now     | End date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)    |

**Success Response (200 OK)**
```json
{
    "data": [
        {
            "date": "2024-01",     // Format varies by interval:
                                   // hourly: "YYYY-MM-DDTHH:00:00.000Z"
                                   // daily: "YYYY-MM-DD"
                                   // weekly: "YYYY-WW"
                                   // monthly: "YYYY-MM"
            "value": 5             // Number of opportunities made public in this period
        }
    ],
    "metadata": {
        "interval": "weekly",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-03-21T00:00:00.000Z",
        "totalOpportunities": 5
    }
}
```

**Error Responses**

*400 Bad Request - Invalid Date Format*
```json
{
    "error": "Invalid startDate format",
    "details": "startDate must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"
}
```

*400 Bad Request - Invalid Date Range*
```json
{
    "error": "Invalid date range",
    "details": "startDate must be before or equal to endDate"
}
```

*400 Bad Request - Invalid Date Range for Hourly Interval*
```json
{
    "error": "Invalid date range for hourly interval",
    "details": "Date range for hourly interval cannot exceed 7 days"
}
```

*400 Bad Request - Invalid Interval*
```json
{
    "error": "Invalid interval",
    "details": "Interval must be one of: hourly, daily, weekly, monthly"
}
```

*401 Unauthorized*
```json
{
    "error": "Authorization header missing or invalid"
}
```

*500 Internal Server Error*
```json
{
    "error": "Internal server error",
    "details": "Error fetching opportunity growth statistics"
}
```

**Example Usage**

```bash
# Get weekly growth statistics for Q1 2024
curl -X GET 'https://your-api/opportunities/stats/growth?interval=weekly&startDate=2024-01-01T00:00:00.000Z&endDate=2024-03-31T23:59:59.999Z' \
  -H 'Authorization: Bearer your-jwt-token'

# Get hourly growth statistics for the last 24 hours
curl -X GET 'https://your-api/opportunities/stats/growth?interval=hourly&startDate=2024-03-20T00:00:00.000Z&endDate=2024-03-21T00:00:00.000Z' \
  -H 'Authorization: Bearer your-jwt-token'
```

**Notes**
- If no dates are provided, the endpoint defaults to showing the last 3 months of data
- The response data is sorted chronologically
- All dates in the response are in ISO 8601 format
- The endpoint counts opportunities based on when they were changed to 'public' status
- Weekly intervals use ISO week numbers (1-53)
- Hourly intervals are limited to a maximum of 7 days to prevent performance issues
- Hourly data points are aligned to the start of each hour (e.g., 13:00:00)

**Usage with shadcn/ui**
```typescript
// React component example
import { LineChart } from '@shadcn/ui/charts';

function OpportunityGrowthChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/opportunities/stats/growth?interval=monthly')
      .then(res => res.json())
      .then(response => setData(response.data));
  }, []);

  return (
    <LineChart
      data={data}
      xField="date"
      yField="value"
      title="Opportunity Growth Over Time"
    />
  );
}
```

## Data Masking Rules
The following data masking rules apply to public opportunities:

1. **Location Information**
   - Original address is replaced with "Generated random address"
   - Coordinates are randomized within a 5km radius of the original location
   - Precision is limited to 4 decimal places (approximately 11 meters)

2. **Contact Information**
   - Full name is replaced with "Generated random name"
   - Email is replaced with "Generated random email"
   - Phone number is masked:
     - Country code is replaced with "+00"
     - Number is replaced with "Generated random phone"

## Status Change Tracking
Every status change is tracked with the following information:

1. **Change Details**
   - Previous status (`from`)
   - New status (`to`)
   - User ID who made the change (`changedBy`)
   - Timestamp of the change (`changedAt`)

2. **History**
   - Complete history is maintained in `statusHistory` array
   - Most recent change is stored in `lastStatusChange` field
   - Changes are tracked with user attribution

## Rate Limiting
- No explicit rate limiting is implemented
- Consider implementing rate limiting in production

## Error Handling
All endpoints follow consistent error response formats:

**Standard Error Response**
```json
{
    "error": "Error message",
    "details": "Detailed error explanation",
    "hint": "Optional hint for resolution"
}
```

**Common HTTP Status Codes**
- 200: Successful operation
- 304: No changes made (status update endpoint)
- 400: Bad request (invalid parameters/body)
- 401: Unauthorized (missing/invalid token)
- 404: Resource not found
- 500: Internal server error

## MongoDB Indexes
The service maintains the following indexes for optimal performance:

1. **Status History Index**
   ```javascript
   { 'statusHistory.changedBy': 1 }
   ```

2. **Compound Index for Sorting**
   ```javascript
   { 
     'statusHistory.changedBy': 1,
     'lastStatusChange.changedAt': -1 
   }
   ```

## Testing
A Postman collection is provided for testing all endpoints. Import `opportunity-service.postman_collection.json` into Postman and set up your environment variables:
- `base_url`: Your Railway service URL
- `auth_token`: Valid JWT token for authentication