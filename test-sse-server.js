#!/usr/bin/env node

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Middleware to check for custom header
const requireCustomHeader = (req, res, next) => {
  const requiredHeader = req.headers['x-api-key'];
  const requiredToken = req.headers['authorization'];
  
  // Check for either x-api-key or authorization header
  if (!requiredHeader && !requiredToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing required header. Please provide either "x-api-key" or "authorization" header.',
      example: {
        'x-api-key': 'test-key-123',
        'authorization': 'Bearer your-token-here'
      }
    });
  }
  
  // Validate the header value (simple validation for testing)
  const validApiKey = 'test-key-123';
  const validToken = 'Bearer test-token-456';
  
  if (requiredHeader && requiredHeader !== validApiKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Invalid x-api-key. Expected: ${validApiKey}`
    });
  }
  
  if (requiredToken && requiredToken !== validToken) {
    return res.status(403).json({
      error: 'Forbidden', 
      message: `Invalid authorization token. Expected: ${validToken}`
    });
  }
  
  next();
};

// SSE endpoint that requires custom headers
app.get('/events', requireCustomHeader, (req, res) => {
  console.log(`[${new Date().toISOString()}] New SSE connection from ${req.ip}`);
  console.log('Headers received:', {
    'x-api-key': req.headers['x-api-key'],
    'authorization': req.headers['authorization'],
    'user-agent': req.headers['user-agent']
  });

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, x-api-key, authorization',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'Connected to SSE test server',
    timestamp: new Date().toISOString(),
    connectionId: Math.random().toString(36).substr(2, 9)
  })}\n\n`);

  let messageCount = 0;
  
  // Send a message every 2 seconds
  const interval = setInterval(() => {
    messageCount++;
    
    const eventData = {
      type: 'message',
      id: messageCount,
      message: `Test message #${messageCount}`,
      timestamp: new Date().toISOString(),
      randomData: {
        value: Math.floor(Math.random() * 100),
        status: Math.random() > 0.5 ? 'active' : 'inactive',
        metadata: {
          server: 'test-sse-server',
          version: '1.0.0'
        }
      }
    };

    // Send with event ID for proper SSE format
    res.write(`id: ${messageCount}\n`);
    res.write(`event: test-message\n`);
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    
    console.log(`[${new Date().toISOString()}] Sent message #${messageCount} to ${req.ip}`);
    
    // Stop after 50 messages to prevent infinite connections during testing
    if (messageCount >= 50) {
      console.log(`[${new Date().toISOString()}] Reaching message limit, closing connection for ${req.ip}`);
      res.write(`data: ${JSON.stringify({
        type: 'disconnect',
        message: 'Reached message limit, closing connection',
        timestamp: new Date().toISOString(),
        totalMessages: messageCount
      })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  // Clean up on client disconnect
  req.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client ${req.ip} disconnected after ${messageCount} messages`);
    clearInterval(interval);
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] SSE connection error for ${req.ip}:`, err.message);
    clearInterval(interval);
  });
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      '/events': 'SSE endpoint (requires x-api-key or authorization header)',
      '/health': 'Health check endpoint',
      '/test': 'Test auth endpoint'
    }
  });
});

// Test endpoint to verify auth is working
app.get('/test', requireCustomHeader, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful!',
    headers: {
      'x-api-key': req.headers['x-api-key'] || 'not provided',
      'authorization': req.headers['authorization'] || 'not provided'
    },
    timestamp: new Date().toISOString()
  });
});

// Root endpoint with instructions
app.get('/', (req, res) => {
  res.json({
    name: 'SSE Test Server',
    version: '1.0.0',
    description: 'Simple Server-Sent Events test server for n8n SSE Trigger Extended testing',
    endpoints: {
      'GET /': 'This help page',
      'GET /health': 'Health check (no auth required)',
      'GET /test': 'Test authentication (requires headers)',
      'GET /events': 'SSE endpoint (requires headers)'
    },
    authentication: {
      required: true,
      methods: [
        {
          header: 'x-api-key',
          value: 'test-key-123',
          example: 'curl -H "x-api-key: test-key-123" http://localhost:3001/events'
        },
        {
          header: 'authorization', 
          value: 'Bearer test-token-456',
          example: 'curl -H "authorization: Bearer test-token-456" http://localhost:3001/events'
        }
      ]
    },
    usage: {
      testNode: 'Use this server to test the n8n SSE Trigger Extended node with custom headers',
      url: `http://localhost:${PORT}/events`,
      headers: 'Set either x-api-key=test-key-123 or authorization=Bearer test-token-456'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SSE Test Server running on http://localhost:${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/events`);
  console.log(`🔑 Required headers:`);
  console.log(`   x-api-key: test-key-123`);
  console.log(`   OR`);
  console.log(`   authorization: Bearer test-token-456`);
  console.log(`\n💡 Test commands:`);
  console.log(`   curl -H "x-api-key: test-key-123" http://localhost:${PORT}/events`);
  console.log(`   curl -H "authorization: Bearer test-token-456" http://localhost:${PORT}/test`);
  console.log(`\n🔍 Health check: http://localhost:${PORT}/health`);
});