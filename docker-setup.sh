#!/bin/bash

echo "🐳 Setting up BillEasy Task with Docker..."

# Build and start services
echo "📦 Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "🔍 Checking service status..."
docker-compose ps

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Application is running at: http://localhost:3002"
echo "📊 Redis is running on port 6380"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Restart: docker-compose restart"
echo "  - View app logs: docker-compose logs -f app"
echo ""
echo "🧪 Test the API with the test-api-enhanced.http file"
echo "    (Update the base URL to http://localhost:3002)" 