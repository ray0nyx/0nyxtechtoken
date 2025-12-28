import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createClient } from '@/lib/supabase/client';

export function TradeEntryForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        symbol: formData.get('symbol') as string,
        position_type: (formData.get('position') as 'LONG' | 'SHORT').toUpperCase(),
        size: Number(formData.get('size')),
        strategy: formData.get('strategy') as string,
        entry_date: formData.get('entry_date') as string,
        exit_date: formData.get('exit_date') as string,
        entry_price: Number(formData.get('entry_price')),
        exit_price: Number(formData.get('exit_price')),
        notes: formData.get('notes') as string,
      };

      // Developer emails with full access
      const developerEmails = ['rayhan@arafatcapital.com', 'sevemadsen18@gmail.com'];

      // Try to get user with session refresh if needed
      let { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!user || userError) {
        console.log('No user found, trying to refresh session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!session || sessionError) {
          console.error('Session refresh failed:', sessionError);
          // Developer bypass
          if (session?.user?.email && developerEmails.includes(session.user.email)) {
            console.log('Developer bypass activated for', session.user.email);
            user = session.user;
          } else {
            throw new Error('Authentication failed. Please try logging in again.');
          }
        } else {
          // Try to get user again after session refresh
          const { data: { user: refreshedUser }, error: refreshedError } = await supabase.auth.getUser();
          if (!refreshedUser || refreshedError) {
            console.error('User fetch after session refresh failed:', refreshedError);
            // Developer bypass
            if (session?.user?.email && developerEmails.includes(session.user.email)) {
              console.log('Developer bypass activated for', session.user.email);
              user = session.user;
            } else {
              throw new Error('Authentication failed. Please try logging in again.');
            }
          } else {
            user = refreshedUser;
          }
        }
      }

      const pnl = (data.exit_price - data.entry_price) * data.size *
        (data.position_type === 'LONG' ? 1 : -1);

      // Map data to match trades table structure
      const tradeData = {
        user_id: user.id,
        symbol: data.symbol,
        side: data.position_type.toLowerCase(), // Map position_type to side
        quantity: data.size,
        price: data.entry_price,
        exit_price: data.exit_price,
        timestamp: data.entry_date,
        exit_time: data.exit_date,
        pnl: pnl,
        net_pnl: pnl, // Assuming no fees for manual entry
        fees: 0,
        trade_date: data.entry_date.split('T')[0], // Extract date part
        platform: 'manual',
        notes: data.notes,
        entry_price: data.entry_price,
        entry_date: data.entry_date,
        exit_date: data.exit_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Insert trade
      const { data: insertedTrade, error: tradeError } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single();

      if (tradeError) {
        console.error('Trade insertion error:', tradeError);
        throw tradeError;
      }

      // Insert journal note
      const { error: journalError } = await supabase
        .from('journal_notes')
        .insert({
          user_id: user.id,
          trade_id: insertedTrade.id,
          symbol: data.symbol,
          position_type: data.position_type,
          entry_date: data.entry_date,
          exit_date: data.exit_date,
          entry_price: data.entry_price,
          exit_price: data.exit_price,
          size: data.size,
          pnl,
          strategy: data.strategy,
          notes: data.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (journalError) throw journalError;

      // Trigger analytics update
      try {
        // Call the analytics update function directly
        const { error: analyticsError } = await supabase.rpc('update_analytics_for_user', {
          p_user_id: user.id
        });

        if (analyticsError) {
          console.warn('Analytics update failed:', analyticsError);
        }
      } catch (analyticsError) {
        console.warn('Analytics update failed:', analyticsError);
        // Don't fail the trade creation if analytics update fails
      }

      toast({
        title: "Success",
        description: "Trade added successfully",
      });

      // Force a page refresh to ensure trades are updated
      window.location.href = '/app/trades';
    } catch (error) {
      console.error('Error adding trade:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add trade',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="symbol">Symbol</Label>
          <Input id="symbol" name="symbol" placeholder="e.g. AAPL" required />
        </div>

        <div className="space-y-2">
          <Label>Position Type</Label>
          <Select name="position" defaultValue="long">
            <SelectTrigger>
              <SelectValue placeholder="Select position type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Position Size</Label>
          <Input id="size" name="size" type="number" min="1" placeholder="Number of shares" required />
        </div>

        <div className="space-y-2">
          <Label>Strategy</Label>
          <Select name="strategy" defaultValue="breakout">
            <SelectTrigger>
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="breakout">Breakout</SelectItem>
              <SelectItem value="momentum">Momentum</SelectItem>
              <SelectItem value="trend">Trend Following</SelectItem>
              <SelectItem value="swing">Swing</SelectItem>
              <SelectItem value="scalping">Scalping</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="entry_date">Entry Date & Time</Label>
            <Input id="entry_date" name="entry_date" type="datetime-local" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exit_date">Exit Date & Time</Label>
            <Input id="exit_date" name="exit_date" type="datetime-local" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="entry_price">Entry Price</Label>
            <Input id="entry_price" name="entry_price" type="number" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exit_price">Exit Price</Label>
            <Input id="exit_price" name="exit_price" type="number" step="0.01" required />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="What worked? What didn't? What would you do differently next time?"
          rows={4}
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline" type="button" onClick={() => navigate('/app/trades')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg">
          {isSubmitting ? 'Saving...' : (
            <>
              <Save className="h-4 w-4" />
              Save Trade
            </>
          )}
        </Button>
      </div>
    </form>
  );
} 