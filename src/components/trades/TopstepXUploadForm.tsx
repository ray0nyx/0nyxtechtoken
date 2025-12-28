import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import Papa from 'papaparse';
import { processTopstepXBatch } from '@/lib/topstepx-utils';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/utils/authUtils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, X, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react';
// Remove mock components since we're importing from lucide-react now

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

interface Account {
  id: string;
  name: string;
  platform: string;
}

interface ProcessError {
  row: number;
  error: string;
  data?: any;
}

interface TopstepXUploadFormProps {
  onSuccess?: () => void;
  accountId?: string;
  directUpload?: boolean; // This will be ignored as we'll always use direct upload
}

export function TopstepXUploadForm({ onSuccess, accountId }: TopstepXUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errors, setErrors] = useState<ProcessError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    // Get the current user using the auth utility
    const getCurrentUser = async () => {
      try {
        const user = await getAuthenticatedUser();
        setUserId(user.id);
      } catch (error) {
        // Fallback: Try direct session check for developers
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const developerIds = [
              '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
              '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
            ];

            if (developerIds.includes(session.user.id)) {
              setUserId(session.user.id);
            } else {
              setUserId(session.user.id);
            }
          }
        } catch (fallbackError) {
          // Silent fail
        }
      }
    };

    getCurrentUser();
  }, []);

  const resetForm = () => {
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrors([]);
      setWarnings([]);
      setProgress(0);
      setSuccess(false);
    }
  };

  const handleFileRemove = () => {
    resetForm();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Try to get userId if not set (for developers)
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const developerIds = [
            '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
            '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
          ];

          if (developerIds.includes(session.user.id)) {
            currentUserId = session.user.id;
            setUserId(currentUserId);
          } else {
            currentUserId = session.user.id;
            setUserId(currentUserId);
          }
        }
      } catch (error) {
        // Silent fail
      }
    }

    if (!file || !currentUserId) {
      if (!file) {
        toast({
          title: "Error",
          description: "Please select a CSV file to upload",
          variant: "destructive",
        });
      } else if (!currentUserId) {
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
      // Parse the CSV file
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          setProgress(30);
          if (results.errors && results.errors.length > 0) {
            // Handle CSV parsing errors
            setErrors(
              results.errors.map((err, index) => ({
                row: (err.row ?? index) + 1,
                error: `CSV parsing error: ${err.message} (${err.code})`,
              }))
            );
            setProgress(100);
            setLoading(false);

            toast({
              title: "Error",
              description: "Failed to parse CSV file. Please check the format.",
              variant: "destructive",
            });
            return;
          }

          try {
            setProgress(50);

            // Get userId again (in case it wasn't set initially but we have a session)
            let finalUserId = userId;
            if (!finalUserId) {
              try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                  const developerIds = [
                    '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
                    '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
                  ];

                  if (developerIds.includes(session.user.id)) {
                    finalUserId = session.user.id;
                    setUserId(finalUserId);
                  } else {
                    finalUserId = session.user.id;
                    setUserId(finalUserId);
                  }
                }
              } catch (error) {
                // Silent fail
              }
            }

            if (!finalUserId) {
              throw new Error('User ID is missing. Please refresh the page and try again.');
            }

            // Always use directUpload = true, pass null as accountId
            const result = await processTopstepXBatch(
              results.data as any[],
              finalUserId,
              null // Always pass null instead of accountId
            );

            setProgress(90);

            if (result) {
              // Check if result indicates success (multiple ways to check)
              // First check if success is explicitly true
              // Then check if we have any successful trades (success_count > 0)
              // Also check if processed > 0 (even if success is false, if we processed trades, it's a success)
              const hasSuccessFlag = result.success === true;
              const hasSuccessCount = result.success_count !== undefined && result.success_count > 0;
              const hasProcessed = result.processed !== undefined && result.processed > 0;
              const hasProcessedCount = result.processed_count !== undefined && result.processed_count > 0;

              const isSuccess = hasSuccessFlag || hasSuccessCount || hasProcessed || hasProcessedCount;

              const processedCount = result.processed_count || result.processed || result.success_count || 0;
              const errorCount = result.error_count || 0;

              // If we processed trades successfully (even if success flag is false), show success
              if (isSuccess || processedCount > 0) {
                setSuccess(true);
                toast({
                  title: "Success",
                  description: `Successfully processed ${processedCount} trades.`,
                });

                // Handle any warnings
                if (result.warnings) {
                  setWarnings(result.warnings);
                }

                // Handle any preprocessing errors
                if (result.preprocess_errors) {
                  setErrors(result.preprocess_errors);
                }

                // Handle detailed errors if any
                if (result.detailed_errors && Array.isArray(result.detailed_errors) && result.detailed_errors.length > 0) {
                  const detailedErrors = result.detailed_errors.map((err: any) => ({
                    row: err.row || 0,
                    error: err.error || 'Unknown error',
                    data: err.data
                  }));
                  setErrors(detailedErrors);
                }

                if (onSuccess) {
                  onSuccess();
                }

                // Navigate back to trades page after successful upload
                setTimeout(() => {
                  window.location.href = '/app/trades';
                }, 2000); // Give user time to see the success message
              } else {
                // Handle partial or complete failure
                // Build comprehensive error message
                let errorMessage = result.error || result.message || "Failed to process trades.";

                // Add debug info if available
                if (result.debug_log && Array.isArray(result.debug_log) && result.debug_log.length > 0) {
                  const lastDebug = result.debug_log[result.debug_log.length - 1];
                  if (lastDebug && !errorMessage.includes(lastDebug)) {
                    errorMessage += ` ${lastDebug}`;
                  }
                }

                // Add auth info if there's an auth issue
                if (result.auth_info) {
                  const authInfo = result.auth_info;
                  if (authInfo.authenticated_user === null || authInfo.authenticated_user === undefined) {
                    errorMessage = "Authentication error: User not authenticated. Please refresh the page and try again.";
                  } else if (authInfo.authenticated_user !== authInfo.provided_user && !authInfo.is_developer) {
                    errorMessage = "Authentication error: User ID mismatch. Please refresh the page and try again.";
                  }
                }

                // If we have detailed errors, include them
                if (result.detailed_errors && Array.isArray(result.detailed_errors) && result.detailed_errors.length > 0) {
                  const firstError = result.detailed_errors[0];
                  if (firstError.error) {
                    errorMessage = firstError.error;
                  }
                }

                // Log full error details for debugging
                console.error('Upload failed:', {
                  result,
                  errorMessage,
                  auth_info: result.auth_info,
                  debug_log: result.debug_log,
                  detailed_errors: result.detailed_errors
                });

                toast({
                  title: "Upload Failed",
                  description: errorMessage,
                  variant: "destructive",
                  duration: 15000, // Show for 15 seconds
                });

                // Set errors for detailed display
                if (result.detailed_errors && Array.isArray(result.detailed_errors) && result.detailed_errors.length > 0) {
                  setErrors(result.detailed_errors.map((err: any) => ({
                    row: err.row || 0,
                    error: err.error || err.error_message || 'Unknown error',
                    data: err.data
                  })));
                } else if (result.errors) {
                  setErrors(Array.isArray(result.errors) ? result.errors : [{ row: 0, error: result.errors }]);
                } else if (result.error) {
                  setErrors([{ row: 0, error: result.error }]);
                } else {
                  setErrors([{ row: 0, error: errorMessage }]);
                }
              }
            } else {
              throw new Error('No response received from the server');
            }
          } catch (error) {
            console.error('Error processing TopstepX batch:', error);

            // Extract detailed error message
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) {
              errorMessage = error.message;

              // Check for common error patterns
              if (errorMessage.includes('not authenticated') || errorMessage.includes('Authentication')) {
                errorMessage = 'Authentication error: Please refresh the page and try again. If you are a developer, ensure your developer status is properly set in the database.';
              } else if (errorMessage.includes('CONNECTION_REFUSED') || errorMessage.includes('Failed to fetch')) {
                errorMessage = 'Connection error: Cannot connect to the database. Please check your internet connection and try again.';
              } else if (errorMessage.includes('constraint') || errorMessage.includes('violates')) {
                errorMessage = 'Data validation error: Please check your CSV format and ensure all required fields are present.';
              }
            } else if (typeof error === 'string') {
              errorMessage = error;
            } else if (error && typeof error === 'object' && 'message' in error) {
              errorMessage = String((error as any).message);
            }

            // Show detailed error to user
            toast({
              title: "Upload Failed",
              description: errorMessage,
              variant: "destructive",
              duration: 15000, // Show for 15 seconds
            });

            // Also set errors state for display
            setErrors([{
              row: 0,
              error: errorMessage,
            }]);
          }

          setProgress(100);
          setLoading(false);
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          setErrors([{ row: 0, error: `Failed to parse CSV file: ${error.message}` }]);
          setLoading(false);
          toast({
            title: "Error",
            description: "Failed to parse CSV file. Is it a valid CSV?",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error('Error submitting TopstepX CSV:', error);
      setLoading(false);

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800 mb-4">
        <h3 className="font-semibold mb-2">TopstepX CSV Upload</h3>
        <p className="mb-3">
          Upload your trades exported from TopstepX. The file should include your trade history with details like symbol, entry/exit prices, and timestamps.
        </p>
        <div className="flex items-center text-xs space-x-1">
          <HelpCircle className="h-3 w-3" />
          <span>Trades will be directly imported without requiring an account selection.</span>
        </div>
      </div>

      {!file ? (
        <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="topstepx-csv-upload"
          />
          <Label
            htmlFor="topstepx-csv-upload"
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
        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>Your trades have been successfully uploaded.</AlertDescription>
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
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
          onClick={resetForm}
          disabled={loading || !file}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !file} className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg">
          {loading ? 'Uploading...' : success ? 'Upload again' : 'Upload'}
        </Button>
      </div>

      <AlertDialog open={loading}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Processing Trades</AlertDialogTitle>
            <AlertDialogDescription>
              Please wait while your trades are being processed...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Progress value={progress} />
          </div>
          <AlertDialogFooter>
            <AlertDialogAction disabled>Cancel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}