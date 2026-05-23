console.log('=== Debugging Auth Middleware ===');

try {
  // Test 1: Import the middleware module
  console.log('1. Importing auth middleware...');
  const authModule = require('./middleware/auth');
  console.log('   Auth module keys:', Object.keys(authModule));
  console.log('   Auth type:', typeof authModule.auth);
  console.log('   Authorize type:', typeof authModule.authorize);
  
  // Test 2: Destructure import
  console.log('2. Testing destructured import...');
  const { auth, authorize } = require('./middleware/auth');
  console.log('   Auth function type:', typeof auth);
  console.log('   Authorize function type:', typeof authorize);
  
  // Test 3: Test if auth is callable
  if (typeof auth === 'function') {
    console.log('✅ Auth middleware is a function');
  } else {
    console.log('❌ Auth middleware is NOT a function:', auth);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}
