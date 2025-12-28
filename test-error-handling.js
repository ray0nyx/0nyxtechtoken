// Test script for error handling
import { handleAuthError, isRateLimitError, extractCooldownTime } from './src/utils/authErrorHandler.js';

console.log('🧪 Testing Auth Error Handling...\n');

// Test cases
const testCases = [
  {
    name: 'Rate limit error (30 seconds)',
    error: { message: 'For security purposes, you can only request this after 30 seconds.' },
    expected: 'Rate Limited'
  },
  {
    name: 'Rate limit error (31 seconds)',
    error: { message: 'For security purposes, you can only request this after 31 seconds.' },
    expected: 'Rate Limited'
  },
  {
    name: 'HTTP 429 status',
    error: { message: 'Too many requests', status: 429 },
    expected: 'Too Many Requests'
  },
  {
    name: 'Network error',
    error: { message: 'Network error occurred' },
    expected: 'Network Error'
  },
  {
    name: 'Invalid email',
    error: { message: 'Invalid email address' },
    expected: 'Invalid Email'
  },
  {
    name: 'User not found',
    error: { message: 'User not found' },
    expected: 'User Not Found'
  },
  {
    name: 'Generic error',
    error: { message: 'Something went wrong' },
    expected: 'Error'
  }
];

// Run tests
testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. Testing: ${testCase.name}`);
  
  const result = handleAuthError(testCase.error);
  
  console.log(`   Input: "${testCase.error.message}"`);
  console.log(`   Expected: ${testCase.expected}`);
  console.log(`   Got: ${result.toastTitle}`);
  console.log(`   Match: ${result.toastTitle === testCase.expected ? '✅' : '❌'}`);
  console.log(`   Should return: ${result.shouldReturn}`);
  console.log('');
});

// Test cooldown extraction
console.log('🕐 Testing Cooldown Extraction:');
const cooldownTests = [
  'For security purposes, you can only request this after 30 seconds.',
  'For security purposes, you can only request this after 31 seconds.',
  'Please wait 45 seconds before trying again.',
  'Rate limit: 60 seconds remaining'
];

cooldownTests.forEach((message, index) => {
  const cooldown = extractCooldownTime({ message });
  console.log(`${index + 1}. "${message}" → ${cooldown} seconds`);
});

// Test rate limit detection
console.log('\n🚫 Testing Rate Limit Detection:');
const rateLimitTests = [
  { message: 'For security purposes, you can only request this after 30 seconds.', expected: true },
  { message: 'Rate limit exceeded', expected: true },
  { message: 'Too many requests', status: 429, expected: true },
  { message: 'Invalid email', expected: false },
  { message: 'Network error', expected: false }
];

rateLimitTests.forEach((test, index) => {
  const isRateLimit = isRateLimitError(test);
  console.log(`${index + 1}. "${test.message}" → ${isRateLimit ? '✅' : '❌'} (expected: ${test.expected})`);
});

console.log('\n🎉 Error handling tests completed!');
