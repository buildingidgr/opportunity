import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import express from 'express';
import axios from 'axios';

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'opportunities_db';
const MONGODB_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || 'opportunities';
const PORT = process.env.PORT || 3000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service-url';

// Create Express app
const app = express();
app.use(express.json());

// Helper function for structured logging
function logEvent(stage, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    stage,
    message,
    ...(data && { data })
  };
  console.log(JSON.stringify(logEntry));
}

// JWT validation middleware
async function validateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logEvent('auth', 'Missing or invalid authorization header');
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      // Log the full token for debugging (be careful with this in production)
      logEvent('auth', 'Attempting to validate token with auth service', {
        url: `${AUTH_SERVICE_URL}/validate`,  // Changed endpoint
        token: token.substring(0, 10) + '...' // Log first 10 chars of token
      });

      // Validate token with auth service
      const response = await axios.post(
        `${AUTH_SERVICE_URL}/validate`,  // Changed endpoint
        { token }, 
        {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Also send token in headers
          },
          timeout: 5000 // 5 second timeout
        }
      );

      logEvent('auth', 'Received response from auth service', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        responseData: response.data // Log the full response for debugging
      });

      // Check if the response indicates a valid token
      if (response.data && (response.data.valid || response.status === 200)) {
        // Add user info to request object
        req.user = {
          id: response.data.userId || response.data.sub || response.data.id,
          ...response.data
        };
        logEvent('auth', 'Token validated successfully', { 
          userId: req.user.id,
          userData: req.user
        });
        next();
      } else {
        logEvent('auth', 'Token validation failed', { 
          token: token.substring(0, 10) + '...',
          response: response.data
        });
        res.status(401).json({ 
          error: 'Invalid token',
          details: response.data?.message || 'Token validation failed',
          hint: 'Please ensure you are using a valid token and the correct authorization header format'
        });
      }
    } catch (error) {
      logEvent('auth', 'Error validating token with auth service', {
        error: error.message,
        code: error.code,
        response: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        },
        request: {
          method: error.config?.method,
          url: error.config?.url,
          headers: {
            ...error.config?.headers,
            'Authorization': 'Bearer [REDACTED]'
          }
        },
        authServiceUrl: AUTH_SERVICE_URL
      });
      
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: 'Auth service is unavailable',
          details: 'Could not connect to authentication service',
          authServiceUrl: AUTH_SERVICE_URL // Include URL for debugging
        });
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return res.status(503).json({ 
          error: 'Auth service timeout',
          details: 'Authentication service took too long to respond'
        });
      }

      if (error.response?.status === 401) {
        return res.status(401).json({ 
          error: 'Invalid token',
          details: error.response.data?.message || 'Token validation failed',
          hint: 'Please check if your token is valid and not expired'
        });
      }
      
      res.status(500).json({ 
        error: 'Error validating token',
        details: 'An unexpected error occurred while validating your token',
        hint: 'Please ensure the AUTH_SERVICE_URL environment variable is correctly set'
      });
    }
  } catch (error) {
    logEvent('auth', 'Unexpected error in token validation', {
      error: error.message,
      stack: error.stack,
      authServiceUrl: AUTH_SERVICE_URL
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred in the authentication process'
    });
  }
}

async function setupHttpServer(db) {
  // Health check endpoint for Railway - no auth required
  app.get('/', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Protected routes - require valid JWT
  app.get('/opportunities/:id', validateToken, async (req, res) => {
    try {
      const id = req.params.id;
      logEvent('http', 'Fetching opportunity by ID', { id });

      const opportunity = await db.collection(MONGODB_COLLECTION_NAME)
        .findOne({ _id: new ObjectId(id) });

      if (!opportunity) {
        logEvent('http', 'Opportunity not found', { id });
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      logEvent('http', 'Successfully fetched opportunity', { id });
      res.json(opportunity);
    } catch (error) {
      if (error.message.includes('ObjectId')) {
        logEvent('http', 'Invalid ID format', { id: req.params.id });
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      logEvent('error', 'Error fetching opportunity', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/opportunities', validateToken, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const category = req.query.category;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 50) {
        return res.status(400).json({
          error: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 50'
        });
      }

      // Build query
      const query = { status: 'public' };
      if (category) {
        query.category = category;
      }

      logEvent('http', 'Fetching public opportunities', { 
        page,
        limit,
        category: category || 'all',
        query
      });

      // Get total count for pagination
      const totalCount = await db.collection(MONGODB_COLLECTION_NAME)
        .countDocuments(query);

      // Calculate pagination values
      const totalPages = Math.ceil(totalCount / limit);

      // Validate requested page number
      if (page > totalPages && totalCount > 0) {
        return res.status(400).json({
          error: `Page ${page} does not exist. Total pages available: ${totalPages}`,
          totalItems: totalCount,
          totalPages: totalPages,
          suggestion: `Try accessing page 1 to ${totalPages}`
        });
      }

      const skip = (page - 1) * limit;

      // Fetch opportunities
      const opportunities = await db.collection(MONGODB_COLLECTION_NAME)
        .find(query)
        .sort({ _id: -1 }) // Sort by newest first
        .skip(skip)
        .limit(limit)
        .toArray();

      logEvent('http', 'Successfully fetched public opportunities', { 
        count: opportunities.length,
        page,
        totalPages,
        query
      });

      // Log the actual documents for debugging
      logEvent('debug', 'Fetched documents', {
        documentCount: opportunities.length,
        documents: opportunities.map(doc => ({
          id: doc._id,
          status: doc.status,
          category: doc.category
        }))
      });

      res.json({
        opportunities,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        filter: {
          category: category || 'all',
          appliedQuery: query
        }
      });
    } catch (error) {
      logEvent('error', 'Error fetching public opportunities', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/opportunities/:id/status', validateToken, async (req, res) => {
    try {
      const id = req.params.id;
      const newStatus = req.body.status?.toLowerCase();
      
      logEvent('http', 'Attempting to update opportunity status', { 
        id,
        newStatus 
      });

      // Validate status value
      const VALID_STATUSES = ['in review', 'public', 'private', 'rejected'];
      if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
        logEvent('http', 'Invalid status value provided', { newStatus });
        return res.status(400).json({ 
          error: 'Invalid status. Allowed values: in review, public, private, rejected' 
        });
      }

      // Get current opportunity
      const opportunity = await db.collection(MONGODB_COLLECTION_NAME)
        .findOne({ _id: new ObjectId(id) });

      if (!opportunity) {
        logEvent('http', 'Opportunity not found', { id });
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      const currentStatus = opportunity.status?.toLowerCase();
      
      // Validate status transitions
      const isValidTransition = (() => {
        switch (currentStatus) {
          case 'in review':
            return ['public', 'rejected'].includes(newStatus);
          case 'public':
            return newStatus === 'private';
          case 'private':
            return false; // Cannot change from private
          case 'rejected':
            return newStatus === 'in review'; // Allow transition from rejected to in review
          default:
            return false;
        }
      })();

      if (!isValidTransition) {
        logEvent('http', 'Invalid status transition', { 
          currentStatus,
          newStatus 
        });
        return res.status(400).json({ 
          error: `Cannot change status from '${currentStatus}' to '${newStatus}'`,
          allowedTransitions: {
            'in review': ['public', 'rejected'],
            'public': ['private'],
            'private': [],
            'rejected': ['in review']
          }
        });
      }

      // Update the status
      const result = await db.collection(MONGODB_COLLECTION_NAME)
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: newStatus } }
        );

      if (result.modifiedCount === 0) {
        logEvent('http', 'No changes made to opportunity', { id });
        return res.status(304).end();
      }

      logEvent('http', 'Successfully updated opportunity status', { 
        id,
        previousStatus: currentStatus,
        newStatus 
      });

      res.json({ 
        message: 'Status updated successfully',
        previousStatus: currentStatus,
        currentStatus: newStatus
      });
    } catch (error) {
      if (error.message.includes('ObjectId')) {
        logEvent('http', 'Invalid ID format', { id: req.params.id });
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      logEvent('error', 'Error updating opportunity status', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    logEvent('error', 'Unhandled error', { 
      error: err.message,
      stack: err.stack 
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    logEvent('shutdown', 'Received shutdown signal');
    // Wait for existing requests to complete (adjust timeout as needed)
    server.close(() => {
      logEvent('shutdown', 'HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start HTTP server
  const server = app.listen(PORT, '0.0.0.0', () => {
    logEvent('startup', 'HTTP server is running', { 
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    });
  });
}

async function start() {
  let connection, channel, db;

  try {
    logEvent('startup', 'Service starting up');
    
    // Connect to RabbitMQ
    logEvent('rabbitmq', 'Attempting to connect to RabbitMQ', { url: RABBITMQ_URL });
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    logEvent('rabbitmq', 'Successfully connected to RabbitMQ');

    // Connect to MongoDB
    logEvent('mongodb', 'Attempting to connect to MongoDB', { url: MONGODB_URL, database: MONGODB_DB_NAME });
    const client = new MongoClient(MONGODB_URL);
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    logEvent('mongodb', 'Successfully connected to MongoDB');

    // Setup HTTP server
    await setupHttpServer(db);

    // Ensure the queue exists
    logEvent('rabbitmq', 'Asserting queue existence', { queue: 'opportunity' });
    await channel.assertQueue('opportunity', { durable: true });
    logEvent('rabbitmq', 'Queue assertion successful');

    // Consume messages
    channel.consume('opportunity', async (msg) => {
      if (msg !== null) {
        const messageId = msg.properties.messageId || 'unknown';
        logEvent('message', 'Received new message', { messageId });
        
        try {
          const content = JSON.parse(msg.content.toString());
          logEvent('message', 'Successfully parsed message content', { 
            messageId,
            eventType: content.eventType,
            fullContent: content
          });

          // Extract the opportunity data
          const opportunityData = content.data;
          logEvent('processing', 'Extracted opportunity data', { 
            messageId,
            opportunityId: opportunityData.id || 'unknown',
            fullData: opportunityData
          });

          // Add status field
          opportunityData.status = 'in review';
          logEvent('processing', 'Added status field to opportunity data', {
            messageId,
            status: opportunityData.status,
            finalData: opportunityData
          });

          // Store in MongoDB
          logEvent('mongodb', 'Attempting to store data', { messageId });
          const result = await db.collection(MONGODB_COLLECTION_NAME).insertOne(opportunityData);
          logEvent('mongodb', 'Successfully stored data', { 
            messageId,
            mongoId: result.insertedId.toString() 
          });

          // Acknowledge the message
          channel.ack(msg);
          logEvent('message', 'Message acknowledged', { messageId });
        } catch (error) {
          logEvent('error', 'Error processing message', { 
            messageId,
            error: error.message,
            stack: error.stack 
          });
          // Nack the message and requeue it
          channel.nack(msg, false, true);
          logEvent('message', 'Message nacked and requeued', { messageId });
        }
      }
    });

    logEvent('startup', 'Service ready and waiting for messages');
  } catch (error) {
    logEvent('error', 'Fatal error occurred', { 
      error: error.message,
      stack: error.stack 
    });
    
    // Attempt to close connections if they were established
    if (channel) {
      logEvent('shutdown', 'Closing RabbitMQ channel');
      await channel.close();
    }
    if (connection) {
      logEvent('shutdown', 'Closing RabbitMQ connection');
      await connection.close();
    }
    if (db) {
      logEvent('shutdown', 'Closing MongoDB connection');
      await db.client.close();
    }
    process.exit(1);
  }
}

start();

