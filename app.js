import amqp from 'amqplib';
import { MongoClient } from 'mongodb';

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'opportunities_db';
const MONGODB_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || 'opportunities';

async function start() {
  let connection, channel, db;

  try {
    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('Connected to RabbitMQ');

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URL);
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    console.log('Connected to MongoDB');

    // Ensure the queue exists
    await channel.assertQueue('opportunity', { durable: true });

    // Consume messages
    channel.consume('opportunity', async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          console.log('Received message:', content.eventType);

          // Extract the opportunity data
          const opportunityData = content.data.data;

          // Store in MongoDB
          const result = await db.collection(MONGODB_COLLECTION_NAME).insertOne(opportunityData);
          console.log('Stored in MongoDB with ID:', result.insertedId);

          // Acknowledge the message
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          // Nack the message and requeue it
          channel.nack(msg, false, true);
        }
      }
    });

    console.log('Waiting for messages. To exit press CTRL+C');
  } catch (error) {
    console.error('Error:', error);
    // Attempt to close connections if they were established
    if (channel) await channel.close();
    if (connection) await connection.close();
    if (db) await db.client.close();
    process.exit(1);
  }
}

start();

