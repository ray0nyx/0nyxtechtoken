import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Upload, X, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react';

import { processTradovateCSV } from '@/lib/tradovate-processor';
import { createClient } from '@/lib/supabase/client';
import { getAuthenticatedUser } from '@/lib/utils/authUtils';
import { getDeveloperAuth } from '@/lib/utils/devAuth';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TradovateUploadFormProps {
  accountId?: string;
  directUpload?: boolean;
}

export function TradovateUploadForm({ accountId, directUpload = false }: TradovateUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ row: number; error: string; data?: any }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    // Immediate authentication with minimal complexity
    const getCurrentUser = async () => {
      console.log('TradovateUploadForm: Starting authentication...');

      // Developer emails with full access
      const developerEmails = ['rayhan@arafatcapital.com', 'sevemadsen18@gmail.com'];

      try {
        // Quick session check
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email && developerEmails.includes(session.user.email)) {
          console.log('TradovateUploadForm: Developer session found');
          setUserId(session.user.id);
          return;
        }

        // If not a developer but has valid session, use that
        if (session?.user?.id) {
          console.log('TradovateUploadForm: Regular user session found');
          setUserId(session.user.id);
          return;
        }
      } catch (error) {
        console.error('TradovateUploadForm: Session check failed:', error);
      }

      // Immediate fallback for developer
      console.log('TradovateUploadForm: Using developer fallback');
      setUserId('00000000-0000-0000-0000-000000000000');
    };

    getCurrentUser();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrors([]);
      setWarnings([]);
      setProgress(0);
      setSuccess(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.toLowerCase().endsWith('.csv')) {
        setFile(droppedFile);
        setErrors([]);
        setWarnings([]);
        setProgress(0);
        setSuccess(false);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please drop a CSV file",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileRemove = () => {
    setFile(null);
    setLoading(false);
    setSuccess(false);
    setErrors([]);
    setWarnings([]);
    setProgress(0);
    setShowDetails(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Debug logging
    console.log('Submit attempt - file:', !!file, 'userId:', userId);

    // If no userId, use fallback immediately
    let currentUserId = userId;
    if (!currentUserId) {
      console.log('No userId found, using developer fallback');
      currentUserId = '00000000-0000-0000-0000-000000000000';
      setUserId(currentUserId);
    }

    if (!file || !currentUserId) {
      if (!file) {
        toast({
          title: "Error",
          description: "Please select a CSV file to upload",
          variant: "destructive",
        });
      } else if (!currentUserId) {
        console.error('No userId found. Current state:', { file: !!file, userId: currentUserId });
        toast({
          title: "Error",
          description: "No authenticated user found. Please try logging in again.",
          variant: "destructive",
        });
      }
      return;
    }

    setLoading(true);
    setProgress(10);
    setErrors([]);
    setWarnings([]);
    setSuccess(false);

    try {
      setProgress(30);

      // If directUpload is true, we don't pass an accountId even if one is provided
      const effectiveAccountId = directUpload ? null : accountId;

      // Process the CSV file as Tradovate
      const results = await processTradovateCSV(file, currentUserId, effectiveAccountId);

      setProgress(90);

      if (results) {
        if (results.tradesProcessed > 0) {
          setSuccess(true);
          toast({
            title: "Success",
            description: `Successfully processed ${results.tradesProcessed} trades.`,
          });

          // Handle any warnings
          if (results.warnings) {
            setWarnings(results.warnings);
          }

          // Handle any preprocessing errors
          if (results.preprocess_errors) {
            setErrors(results.preprocess_errors);
          }

          // Navigate back to trades page after successful upload
          setTimeout(() => {
            window.location.href = '/app/trades';
          }, 2000); // Give user time to see the success message
        } else {
          throw new Error('No trades were processed from the CSV file');
        }
      } else {
        throw new Error('No response received from the server');
      }
    } catch (error: any) {
      console.error('Error processing Tradovate CSV:', error);
      toast({
        title: "Error",
        description: error.message || 'An unknown error occurred',
        variant: "destructive",
      });
      setErrors([{ row: 0, error: error.message || 'Failed to process CSV file' }]);
    }

    setProgress(100);
    setLoading(false);
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800 mb-4">
        <h3 className="font-semibold mb-2">Tradovate CSV Upload</h3>
        <p className="mb-3">
          Upload your trades exported from Tradovate. The file should include your trade history with details like symbol, entry/exit prices, and timestamps.
        </p>
        <div className="flex items-center text-xs space-x-1">
          <HelpCircle className="h-3 w-3" />
          <span>Trades will be directly imported without requiring an account selection.</span>
        </div>
      </div>

      {!file ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center hover:border-gray-400 transition-colors"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="tradovate-csv-upload"
          />
          <Label
            htmlFor="tradovate-csv-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-700">Click to select a CSV file</span>
            <span className="text-xs text-gray-500 mt-1">or drag and drop your file here</span>
          </Label>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-xs">.csv</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFileRemove}
              className="text-gray-500 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Processing trades...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>Your trades have been successfully uploaded.</AlertDescription>
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error processing some trades</AlertTitle>
          <AlertDescription>
            {errors.length === 1 ? (
              <span>{errors[0].error}</span>
            ) : (
              <>
                <span>There were {errors.length} errors during processing.</span>
                <Button
                  variant="link"
                  className="text-red-800 p-0 h-auto text-sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                </Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {showDetails && errors.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-md text-sm max-h-60 overflow-y-auto">
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li key={index} className="text-gray-700">
                <span className="font-medium">Row {error.row}:</span>{' '}
                <span>{error.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-sm space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleFileRemove}
          disabled={loading || !file}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !file} className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg">
          {loading ? 'Uploading...' : success ? 'Upload again' : 'Upload'}
        </Button>
      </div>
    </form>
  );
} 