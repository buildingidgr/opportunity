# API Documentation

## Base URL
The service is deployed on Railway platform. Use your Railway-provided URL as the base URL.

## Authentication
All endpoints (except health check) require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer your-jwt-token
```

## Endpoints

### 1. Health Check
```
GET /
```

No authentication required.

**Response (200 OK)**
```json
{
    "status": "healthy",
    "timestamp": "2023-12-20T10:00:00.000Z"
}
```

### 2. Get Public Opportunities (with pagination)
```
GET /opportunities
```

Retrieves a paginated list of public opportunities with masked sensitive data.

**Query Parameters**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `category` (optional): Filter by project category

**Response (200 OK)**
```json
{
    "opportunities": [
        {
            "_id": "6761e3f3a2bf30a81b20906e",
            "type": "opportunity.created",
            "data": {
                "project": {
                    "category": {
                        "title": "Category Title",
                        "description": "Category Description"
                    },
                    "location": {
                        "address": "Generated random address",
                        "coordinates": {
                            "lat": 40.6823,  // Within 5km of original
                            "lng": 21.6498   // Within 5km of original
                        }
                    },
                    "details": {
                        "description": "Project description"
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
                "changedBy": "user-123",
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

### 3. Get Single Opportunity
```
GET /opportunities/:id
```

Retrieves a specific opportunity by ID.

**Parameters**
- `id`: MongoDB ObjectId of the opportunity

**Response (200 OK)**
```json
{
    "_id": "6761e3f3a2bf30a81b20906e",
    "type": "opportunity.created",
    "data": {
        // Opportunity data
    },
    "status": "public",
    "lastStatusChange": {
        "from": "in review",
        "to": "public",
        "changedBy": "user-123",
        "changedAt": "2023-12-20T15:30:45.123Z"
    },
    "statusHistory": [
        {
            "from": "in review",
            "to": "public",
            "changedBy": "user-123",
            "changedAt": "2023-12-20T15:30:45.123Z"
        }
    ]
}
```

### 4. Update Opportunity Status
```
PATCH /opportunities/:id/status
```

Updates the status of an opportunity.

**Parameters**
- `id`: MongoDB ObjectId of the opportunity

**Request Body**
```json
{
    "status": "public" // Allowed values: "in review", "public", "private", "rejected"
}
```

**Allowed Status Transitions**
- From "in review" → "public" or "rejected"
- From "public" → "private"
- From "rejected" → "in review"
- From "private" → no changes allowed

**Response (200 OK)**
```json
{
    "message": "Status updated successfully",
    "statusChange": {
        "previousStatus": "in review",
        "newStatus": "public",
        "changedBy": "user-123",
        "changedAt": "2023-12-20T15:30:45.123Z"
    }
}
```

## Error Responses

### 400 Bad Request
```json
{
    "error": "Invalid status",
    "allowedTransitions": {
        "in review": ["public", "rejected"],
        "public": ["private"],
        "private": [],
        "rejected": ["in review"]
    }
}
```

### 401 Unauthorized
```json
{
    "error": "Invalid token",
    "details": "Token validation failed",
    "hint": "Please ensure you are using a valid token"
}
```

### 404 Not Found
```json
{
    "error": "Opportunity not found"
}
```

### 500 Internal Server Error
```json
{
    "error": "Internal server error"
}
```

## Data Masking
For public opportunities, the following fields are masked:
1. Address: Replaced with "Generated random address"
2. Coordinates: Randomized within 5km of original location
3. Contact information:
   - Name: "Generated random name"
   - Email: "Generated random email"
   - Phone: "Generated random phone"

## Status Change Tracking
Every status change is tracked with:
1. Previous status
2. New status
3. User ID who made the change
4. Timestamp of the change
5. Complete history of all status changes