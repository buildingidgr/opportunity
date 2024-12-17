import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import express from 'express';

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'opportunities_db';
const MONGODB_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || 'opportunities';
const PORT = process.env.PORT || 3000;

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

async function setupHttpServer(db) {
  // Health check endpoint for Railway
  app.get('/', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // GET endpoint to fetch opportunity by ID
  app.get('/opportunities/:id', async (req, res) => {
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

