import { useState } from "react";
import { Trade } from "@/types/trade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, FileText, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils";

interface TradesTableProps {
  trades: Trade[];
}

const TradesTable = ({ trades }: TradesTableProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof Trade>("exit_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (column: keyof Trade) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  const filteredTrades = trades.filter((trade) => 
    trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trade.strategy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    if (sortBy === "exit_date" || sortBy === "entry_date" || sortBy === "date") {
      const aDate = a[sortBy] as Date;
      const bDate = b[sortBy] as Date;
      return sortDirection === "asc" ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
    }
    
    if (typeof a[sortBy] === "number" && typeof b[sortBy] === "number") {
      return sortDirection === "asc"
        ? (a[sortBy] as number) - (b[sortBy] as number)
        : (b[sortBy] as number) - (a[sortBy] as number);
    }
    
    return sortDirection === "asc"
      ? String(a[sortBy]).localeCompare(String(b[sortBy]))
      : String(b[sortBy]).localeCompare(String(a[sortBy]));
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trades..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="sm:w-auto w-full flex items-center gap-2"
          onClick={() => navigate("/trade/new")}
        >
          <FileText className="h-4 w-4" />
          Add Trade
        </Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Exit Price</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Broker</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No trades found
                </TableCell>
              </TableRow>
            ) : (
              sortedTrades.map((trade) => (
                <TableRow key={trade.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/trade/${trade.id}`)}>
                  <TableCell>{formatDate(trade.exit_date)}</TableCell>
                  <TableCell className="font-medium">{trade.symbol}</TableCell>
                  <TableCell className={trade.position === 'long' ? 'text-green-600' : 'text-red-600'}>
                    {trade.position.toUpperCase()}
                  </TableCell>
                  <TableCell>{formatCurrency(trade.entry_price)}</TableCell>
                  <TableCell>{formatCurrency(trade.exit_price)}</TableCell>
                  <TableCell>{trade.quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {trade.fees ? `-${formatCurrency(trade.fees)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {trade.commission ? `-${formatCurrency(trade.commission)}` : '-'}
                  </TableCell>
                  <TableCell className={`text-right ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(trade.pnl)}
                  </TableCell>
                  <TableCell>{trade.strategy}</TableCell>
                  <TableCell>{trade.broker}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TradesTable;
