import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SimpleLeaderboard() {
  console.log("SimpleLeaderboard component rendering");
  
  const staticData = [
    { id: '1', trader_name: 'John Doe', monthly_pnl: 12500, rank: 1 },
    { id: '2', trader_name: 'Jane Smith', monthly_pnl: 9800, rank: 2 },
    { id: '3', trader_name: 'Robert Johnson', monthly_pnl: 8700, rank: 3 },
    { id: '4', trader_name: 'Emily Davis', monthly_pnl: 7600, rank: 4 },
    { id: '5', trader_name: 'Michael Brown', monthly_pnl: 6500, rank: 5 },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "bg-yellow-500 text-black";
    if (rank === 2) return "bg-gray-300 text-black";
    if (rank === 3) return "bg-amber-600 text-black";
    return "bg-blue-600 text-white";
  };

  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-bold">Simple Static Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Rank</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead className="text-right">Monthly P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staticData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankBadgeClass(entry.rank)}`}>
                      {entry.rank}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{entry.trader_name}</TableCell>
                  <TableCell className={`text-right font-bold ${entry.monthly_pnl >= 0 ? 'text-blue-500' : 'text-fuchsia-500'}`}>
                    {formatCurrency(entry.monthly_pnl)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 