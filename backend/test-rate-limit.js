/**
 * Test script to debug rate limiting issues
 * Run with: node test-rate-limit.js
 */

import 'dotenv/config';

console.log('🧪 Testing Rate Limiting Configuration...\n');

// Test the rate limiter configuration
import { 
  generalRateLimiter, 
  devLoginRateLimiter, 
  clearRateLimits,
  getRateLimitStatus 
} from './src/middleware/rateLimiter.js';

console.log('Rate Limiter Configuration:');
console.log('- General Rate Limiter: 200 requests per 15 minutes (skips auth routes)');
console.log('- Dev Login Rate Limiter: 50 requests per 5 minutes');
console.log('');

// Clear any existing rate limits
clearRateLimits();
console.log('✅ Cleared existing rate limits');

// Test IP detection
const testReq = {
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'x-forwarded-for': '192.168.1.100',
    'user-agent': 'test-agent'
  },
  ip: '192.168.1.100'
};

console.log('\n🔍 Testing IP detection:');
console.log('Test request:', {
  path: testReq.path,
  ip: testReq.ip,
  forwarded: testReq.headers['x-forwarded-for']
});

// Test rate limiter behavior
console.log('\n🧪 Testing rate limiter behavior...');

// Simulate a few requests
for (let i = 1; i <= 3; i++) {
  console.log(`\n--- Request ${i} ---`);
  
  // Test general rate limiter (should skip auth routes)
  console.log('General rate limiter (should skip auth routes):');
  const generalResult = generalRateLimiter(testReq, { status: () => 200, set: () => {}, json: () => {} }, () => {
    console.log('✅ General rate limiter: ALLOWED');
  });
  
  // Test login rate limiter
  console.log('Login rate limiter:');
  const loginResult = devLoginRateLimiter(testReq, { status: () => 200, set: () => {}, json: () => {} }, () => {
    console.log('✅ Login rate limiter: ALLOWED');
  });
}

// Check rate limit status
console.log('\n📊 Rate Limit Status:');
const status = getRateLimitStatus('192.168.1.100');
console.log('Status:', status);

console.log('\n🎯 Expected Results:');
console.log('- General rate limiter should skip auth routes (no rate limiting)');
console.log('- Login rate limiter should allow requests (50 per 5 minutes)');
console.log('- No 429 errors should occur for normal usage');

console.log('\n🔧 If you still get 429 errors:');
console.log('1. Check Vercel logs for the debug output');
console.log('2. Look for "🚫 Rate limit exceeded" messages');
console.log('3. Check if the IP detection is working correctly');
console.log('4. Verify that auth routes are being skipped by the general rate limiter');
