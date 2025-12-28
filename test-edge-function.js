// Simple script to test the register-user edge function
const testEdgeFunction = async () => {
  try {
    console.log('Testing register-user edge function...');
    
    // Generate a unique email for testing
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'Test123456!';
    
    // Supabase anon key - replace with your actual anon key
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3R4YXdrdXRsamVpbXZqYWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0NzA1ODAsImV4cCI6MjA0MTA0NjU4MH0.Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx';
    
    console.log(`Using test email: ${testEmail}`);
    
    // Call the edge function
    const response = await fetch(
      'https://nlctxawkutljeimvjacp.supabase.co/functions/v1/register-user',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword
        })
      }
    );
    
    console.log('Response status:', response.status);
    
    // Parse the response
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('Test successful!');
    } else {
      console.error('Test failed:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error testing edge function:', error);
  }
};

// Run the test
testEdgeFunction(); 