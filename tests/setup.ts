// Test setup file
import mongoose from 'mongoose';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/softworks-test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PORT = '3001';

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(async () => {
  // Clean up any test data if needed
});

// Global teardown
afterAll(async () => {
  // Close any open connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});