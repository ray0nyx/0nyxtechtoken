import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from "sonner";

const NewTrade = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Trade added successfully");
      navigate('/journal');
    }, 1000);
  };

  return (
    <div className="container mx-auto px-4 pt-20 pb-12">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mr-4"
          onClick={() => navigate('/journal')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Add New Trade</h1>
      </div>

      <Card className="max-w-3xl mx-auto animate-fade-in">
        <CardHeader>
          <CardTitle>Trade Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input id="symbol" placeholder="e.g. AAPL" required />
              </div>
              
              <div className="space-y-2">
                <Label>Position Type</Label>
                <Select defaultValue="long">
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
                <Input id="size" type="number" min="1" placeholder="Number of shares" required />
              </div>
              
              <div className="space-y-2">
                <Label>Strategy</Label>
                <Select defaultValue="breakout">
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
                  <Input id="entry_date" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit_date">Exit Date & Time</Label>
                  <Input id="exit_date" type="datetime-local" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_price">Entry Price</Label>
                  <Input id="entry_price" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit_price">Exit Price</Label>
                  <Input id="exit_price" type="number" step="0.01" required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Emotional State</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select emotional state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calm">Calm</SelectItem>
                    <SelectItem value="confident">Confident</SelectItem>
                    <SelectItem value="anxious">Anxious</SelectItem>
                    <SelectItem value="frustrated">Frustrated</SelectItem>
                    <SelectItem value="excited">Excited</SelectItem>
                    <SelectItem value="fearful">Fearful</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Market Condition</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select market condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bullish">Bullish</SelectItem>
                    <SelectItem value="bearish">Bearish</SelectItem>
                    <SelectItem value="choppy">Choppy</SelectItem>
                    <SelectItem value="volatile">Volatile</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="ranging">Ranging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="setup">Trade Setup</Label>
              <Input id="setup" placeholder="e.g. Daily resistance break" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="What worked? What didn't? What would you do differently next time?"
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" type="button" onClick={() => navigate('/journal')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20">
                {isSubmitting ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Trade
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewTrade;
