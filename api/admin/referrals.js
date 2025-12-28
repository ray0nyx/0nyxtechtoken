const { createClient } = require('../lib/supabase/client');

// Initialize Supabase client
const supabase = createClient();

export default async function handler(req, res) {
  try {
    // Only accept GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify admin access
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if user is the known admin user
    if (userId !== "856950ff-d638-419d-bcf1-b7dac51d1c7f") {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Fetch referrals
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching referrals:', error);
      return res.status(500).json({ error: 'Failed to fetch referrals' });
    }

    return res.status(200).json(referrals || []);
  } catch (error) {
    console.error('Error in referrals API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
