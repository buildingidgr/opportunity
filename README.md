# RabbitMQ to MongoDB Service

This service consumes messages from a RabbitMQ queue called "opportunity" and stores them in a MongoDB database.

## Deployment on Railway

To deploy this service on Railway, follow these steps:

1. Fork this repository to your GitHub account.

2. Create a new project on Railway and connect it to your forked GitHub repository.

3. In the Railway project settings, add the following environment variables:
   - `RABBITMQ_URL`: Your RabbitMQ connection string
   - `MONGODB_URL`: Your MongoDB connection string
   - `MONGODB_DB_NAME`: The name of your MongoDB database (default: opportunities_db)
   - `MONGODB_COLLECTION_NAME`: The name of your MongoDB collection (default: opportunities)

4. Railway will automatically detect the `Procfile` and use it to start the service.

5. Deploy your project on Railway.

## Local Development

To run this service locally:

1. Install dependencies:

