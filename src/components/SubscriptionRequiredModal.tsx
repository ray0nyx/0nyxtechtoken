import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SubscriptionRequiredModalProps {
  isOpen: boolean;
}

export function SubscriptionRequiredModal({ isOpen }: SubscriptionRequiredModalProps) {
  const navigate = useNavigate();

  const handleSubscribe = () => {
    navigate('/app/pricing');
  };

  // This modal cannot be closed normally - user must subscribe
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Subscription Required</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Welcome to 0nyx Trading! To start using the platform, you need to select a subscription plan.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 bg-gray-50 rounded-lg mt-4">
          <h3 className="font-semibold text-lg mb-2">Benefits of 0nyx Trading:</h3>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>Track and analyze your trades with detailed metrics</li>
            <li>Visualize your performance with advanced charts</li>
            <li>Identify your strengths and weaknesses</li>
            <li>Make data-driven decisions to improve your results</li>
          </ul>
        </div>
        <div className="flex justify-center mt-4">
          <Button 
            onClick={handleSubscribe} 
            size="lg" 
            className="w-full bg-[#8b008b] hover:bg-[#6b006b]"
          >
            Choose a Subscription Plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 