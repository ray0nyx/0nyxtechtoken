import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { Trophy } from "lucide-react";

export default function Leaderboard() {
  const { theme } = useTheme();
  const [currentPeriod, setCurrentPeriod] = useState("monthly");

  useEffect(() => {
    console.log("Leaderboard page mounted");
  }, []);

  return (
    <div className="w-full max-w-none py-6 md:py-8 px-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
            <Trophy className="h-8 w-8 text-yellow-400" />
          </div>
          <div>
            <h1 
              className="text-3xl md:text-4xl font-bold text-purple-500"
            >
              Trader Leaderboard
            </h1>
            <p 
              className="mt-1"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              Top performing traders ranked by monthly P&L
            </p>
          </div>
        </div>
        
        <div>
          <Tabs defaultValue="monthly" value={currentPeriod} onValueChange={setCurrentPeriod} className="w-full">
            <TabsList 
              className="grid w-full grid-cols-1 md:w-[400px] border border-slate-700/50"
              style={{
                backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
              }}
            >
              <TabsTrigger 
                value="monthly" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
                style={{
                  color: theme === 'dark' ? 'rgb(203 213 225)' : 'rgb(55 65 81)',
                }}
              >
                Monthly Rankings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <Card 
          className="border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-yellow-500/10 overflow-hidden"
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardHeader className="bg-yellow-500/10">
            <CardTitle 
              className="flex items-center gap-2"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              <div className="p-1.5 rounded-lg bg-yellow-500/20">
                <Trophy className="h-4 w-4 text-yellow-400" />
              </div>
              Trader Performance Rankings
            </CardTitle>
            <CardDescription 
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              Top 100 traders ranked by their P&L performance for the current month.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-1 sm:px-4">
            <LeaderboardTable />
          </CardContent>
        </Card>
        
        <Card 
          className="border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-orange-500/10 overflow-hidden"
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardHeader className="bg-orange-500/10">
            <CardTitle 
              className="flex items-center gap-2"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              <div className="p-1.5 rounded-lg bg-orange-500/20">
                <Trophy className="h-4 w-4 text-orange-400" />
              </div>
              About the Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-4 py-4">
            <div 
              className="space-y-4"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              <p>
                The leaderboard displays the top 100 traders based on their monthly P&L (Profit & Loss).
                Rankings are updated in real-time as trades are logged.
              </p>
              <p>
                <strong style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>How it works:</strong> Each trader's P&L is calculated from all trades submitted during the current month. 
                The leaderboard shows who's performing best in the current period.
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>P&L</strong> - Total profit and loss for the month</li>
              </ul>
              <p>
                <strong style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}>Privacy:</strong> We only display names, no other personal information is shared.
                If you haven't set a name in your profile, you'll appear as "Anonymous Trader".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 