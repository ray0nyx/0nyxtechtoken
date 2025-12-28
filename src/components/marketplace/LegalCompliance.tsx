import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, FileText, Scale, Users, Eye } from 'lucide-react';

interface LegalComplianceProps {
  productType: 'guide' | 'template' | 'script' | 'indicator' | 'strategy' | 'signal' | 'algorithm';
  showFullDisclaimer?: boolean;
}

export default function LegalCompliance({ productType, showFullDisclaimer = false }: LegalComplianceProps) {
  const getProductTypeDisclaimer = (type: string) => {
    switch (type) {
      case 'guide':
        return {
          title: 'Educational Content Disclaimer',
          content: 'This educational content is for informational purposes only and does not constitute investment advice, financial advice, trading advice, or any other sort of advice. You should not treat any of the content as such.',
          additional: 'Past performance does not guarantee future results. Trading involves substantial risk of loss and may not be suitable for all investors.'
        };
      case 'signal':
        return {
          title: 'Trading Signal Disclaimer',
          content: 'These signals are for informational purposes only and do not constitute investment advice. You must execute trades manually at your own risk and discretion.',
          additional: 'Past performance does not guarantee future results. Trading involves substantial risk of loss and may not be suitable for all investors.'
        };
      case 'algorithm':
        return {
          title: 'Algorithm Software Disclaimer',
          content: 'This software is provided as-is without warranty of any kind. Past performance does not guarantee future results. You are responsible for testing and validating any algorithm before use.',
          additional: 'Trading involves substantial risk of loss and may not be suitable for all investors. You are solely responsible for your trading decisions.'
        };
      default:
        return {
          title: 'General Disclaimer',
          content: 'This product is for informational purposes only and does not constitute investment advice.',
          additional: 'Past performance does not guarantee future results. Trading involves substantial risk of loss.'
        };
    }
  };

  const disclaimer = getProductTypeDisclaimer(productType);

  const regulatoryCompliance = [
    {
      title: 'No Investment Advice',
      description: 'We do not provide investment advice, financial advice, trading advice, or any other sort of advice.',
      icon: <AlertTriangle className="h-4 w-4" />
    },
    {
      title: 'No Money Management',
      description: 'We do not manage money or execute trades on behalf of users. All trades must be executed manually by the user.',
      icon: <Users className="h-4 w-4" />
    },
    {
      title: 'Educational Purpose',
      description: 'All content is for educational and informational purposes only.',
      icon: <FileText className="h-4 w-4" />
    },
    {
      title: 'User Responsibility',
      description: 'Users are solely responsible for their trading decisions and risk management.',
      icon: <Shield className="h-4 w-4" />
    }
  ];

  const riskWarnings = [
    'Trading involves substantial risk of loss and may not be suitable for all investors',
    'Past performance does not guarantee future results',
    'You should carefully consider your investment objectives, level of experience, and risk appetite',
    'Never trade with money you cannot afford to lose',
    'Seek independent financial advice if you have any doubts'
  ];

  if (showFullDisclaimer) {
    return (
      <div className="space-y-6">
        {/* Main Disclaimer */}
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <div className="space-y-2">
              <h3 className="font-semibold text-yellow-800">{disclaimer.title}</h3>
              <p className="text-yellow-700">{disclaimer.content}</p>
              <p className="text-yellow-700">{disclaimer.additional}</p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Regulatory Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Scale className="h-5 w-5" />
              <span>Regulatory Compliance</span>
            </CardTitle>
            <CardDescription>
              Important legal information about our marketplace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regulatoryCompliance.map((item, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mt-0.5">{item.icon}</div>
                  <div>
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Warnings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Risk Warnings</span>
            </CardTitle>
            <CardDescription>
              Important risks associated with trading and financial markets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {riskWarnings.map((warning, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-gray-700">{warning}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Terms and Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Terms and Conditions</span>
            </CardTitle>
            <CardDescription>
              By using this marketplace, you agree to our terms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium mb-2">Marketplace Terms:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• All sales are final unless otherwise specified</li>
                  <li>• Refunds are at the discretion of individual sellers</li>
                  <li>• Platform takes a 10% commission on all sales</li>
                  <li>• Users must comply with all applicable laws and regulations</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Intellectual Property:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Sellers retain ownership of their original content</li>
                  <li>• Buyers receive a license to use the content as specified</li>
                  <li>• Redistribution without permission is prohibited</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Compact version for product cards
  return (
    <div className="space-y-2">
      <Alert className="border-yellow-200 bg-yellow-50 py-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-xs text-yellow-700">
          <strong>Disclaimer:</strong> {disclaimer.content}
        </AlertDescription>
      </Alert>
      
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          Educational Only
        </Badge>
        <Badge variant="outline" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          High Risk
        </Badge>
        <Badge variant="outline" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          Past Performance
        </Badge>
      </div>
    </div>
  );
}
