import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertTriangle, Info } from 'lucide-react';

interface TaxCalculation {
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalNetGains: number;
  taxOwed: number;
  effectiveRate: number;
}

export function TaxCalculator() {
  const [formData, setFormData] = useState({
    shortTermGains: 0,
    longTermGains: 0,
    shortTermLosses: 0,
    longTermLosses: 0,
    filingStatus: 'single',
    state: 'CA',
    additionalIncome: 0,
  });

  const [calculation, setCalculation] = useState<TaxCalculation | null>(null);

  const calculateTax = () => {
    const { shortTermGains, longTermGains, shortTermLosses, longTermLosses, filingStatus, additionalIncome } = formData;
    
    const netShortTerm = shortTermGains - shortTermLosses;
    const netLongTerm = longTermGains - longTermLosses;
    const totalNetGains = netShortTerm + netLongTerm;

    // Simplified tax calculation (2024 rates)
    const taxBrackets = {
      single: [
        { min: 0, max: 11000, rate: 0.10 },
        { min: 11000, max: 44725, rate: 0.12 },
        { min: 44725, max: 95375, rate: 0.22 },
        { min: 95375, max: 182050, rate: 0.24 },
        { min: 182050, max: 231250, rate: 0.32 },
        { min: 231250, max: 578125, rate: 0.35 },
        { min: 578125, max: Infinity, rate: 0.37 }
      ],
      married: [
        { min: 0, max: 22000, rate: 0.10 },
        { min: 22000, max: 89450, rate: 0.12 },
        { min: 89450, max: 190750, rate: 0.22 },
        { min: 190750, max: 364200, rate: 0.24 },
        { min: 364200, max: 462500, rate: 0.32 },
        { min: 462500, max: 693750, rate: 0.35 },
        { min: 693750, max: Infinity, rate: 0.37 }
      ]
    };

    const brackets = taxBrackets[filingStatus as keyof typeof taxBrackets];
    const totalIncome = additionalIncome + Math.max(0, totalNetGains);
    
    let taxOwed = 0;
    let remainingIncome = totalIncome;

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break;
      
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
      taxOwed += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }

    // Capital gains tax (simplified)
    const capitalGainsTax = Math.max(0, totalNetGains) * 0.20; // 20% for long-term
    const shortTermTax = Math.max(0, netShortTerm) * 0.22; // Ordinary income rate for short-term

    const totalTax = taxOwed + capitalGainsTax + shortTermTax;
    const effectiveRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;

    setCalculation({
      shortTermGains,
      longTermGains,
      shortTermLosses,
      longTermLosses,
      netShortTerm,
      netLongTerm,
      totalNetGains,
      taxOwed: totalTax,
      effectiveRate
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Tax Calculator
        </CardTitle>
        <CardDescription>
          Estimate your capital gains tax liability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shortTermGains">Short-term Capital Gains</Label>
            <Input
              id="shortTermGains"
              type="number"
              value={formData.shortTermGains}
              onChange={(e) => setFormData({ ...formData, shortTermGains: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longTermGains">Long-term Capital Gains</Label>
            <Input
              id="longTermGains"
              type="number"
              value={formData.longTermGains}
              onChange={(e) => setFormData({ ...formData, longTermGains: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortTermLosses">Short-term Capital Losses</Label>
            <Input
              id="shortTermLosses"
              type="number"
              value={formData.shortTermLosses}
              onChange={(e) => setFormData({ ...formData, shortTermLosses: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longTermLosses">Long-term Capital Losses</Label>
            <Input
              id="longTermLosses"
              type="number"
              value={formData.longTermLosses}
              onChange={(e) => setFormData({ ...formData, longTermLosses: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filingStatus">Filing Status</Label>
            <Select value={formData.filingStatus} onValueChange={(value) => setFormData({ ...formData, filingStatus: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married Filing Jointly</SelectItem>
                <SelectItem value="head">Head of Household</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="additionalIncome">Additional Income</Label>
            <Input
              id="additionalIncome"
              type="number"
              value={formData.additionalIncome}
              onChange={(e) => setFormData({ ...formData, additionalIncome: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
        </div>

        <Button onClick={calculateTax} className="w-full">
          Calculate Tax
        </Button>

        {/* Results */}
        {calculation && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Tax Calculation Results</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Net Short-term Gains/Losses</span>
                  <span className={calculation.netShortTerm >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatCurrency(calculation.netShortTerm)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Net Long-term Gains/Losses</span>
                  <span className={calculation.netLongTerm >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatCurrency(calculation.netLongTerm)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total Net Capital Gains</span>
                  <span className={calculation.totalNetGains >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatCurrency(calculation.totalNetGains)}
                  </span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Estimated Tax Owed</span>
                    <span className="text-red-500">{formatCurrency(calculation.taxOwed)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Effective Tax Rate</span>
                  <span>{calculation.effectiveRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Tax Optimization Tips */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Tax Optimization Tips
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {calculation.totalNetGains > 0 && (
                  <p>• Consider harvesting losses to offset gains</p>
                )}
                {calculation.netShortTerm > 0 && (
                  <p>• Hold positions longer to qualify for long-term rates</p>
                )}
                {calculation.taxOwed > 10000 && (
                  <p>• Consider quarterly estimated tax payments</p>
                )}
                <p>• Consult a tax professional for complex situations</p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="border-t pt-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-yellow-600 mb-1">Disclaimer</p>
                  <p>
                    This calculator provides estimates only. Actual tax liability may vary based on 
                    deductions, credits, and other factors. Consult a qualified tax professional 
                    for accurate tax planning and preparation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
