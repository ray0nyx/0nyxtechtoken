import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

interface SharePnLImageProps {
  dailyPnL: number;
  buttonClassName?: string;
}

export function SharePnLImage({ dailyPnL, buttonClassName }: SharePnLImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Get current date
  const today = new Date();
  const formattedDate = format(today, 'MMMM d, yyyy');
  const fileDate = format(today, 'yyyy-MM-dd');

  const generateImage = async () => {
    if (!imageRef.current) return;

    try {
      setIsGenerating(true);
      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: null,
        scale: 2, // Higher resolution
      });

      const dataUrl = canvas.toDataURL('image/png');
      setImageUrl(dataUrl);
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `pnl-${fileDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareImage = async () => {
    if (!imageUrl) return;

    try {
      // Convert base64 to blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      if (navigator.share) {
        await navigator.share({
          title: `My P&L for ${formattedDate}`,
          files: [new File([blob], `pnl-${fileDate}.png`, { type: 'image/png' })],
        });
      } else {
        // Fallback to download if Web Share API is not available
        downloadImage();
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      // Fallback to download
      downloadImage();
    }
  };

  // Format P&L value
  const isProfitable = dailyPnL > 0;
  const hasNoTrades = dailyPnL === 0;
  const formattedPnL = Math.abs(dailyPnL).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={buttonClassName || "flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"}>
          <Share2 className="h-4 w-4" />
          Share P&L
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Daily P&L</DialogTitle>
          <DialogDescription>
            Generate a shareable image of your daily profit or loss.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <div
            ref={imageRef}
            className="w-[400px] h-[400px] bg-background flex flex-col items-center justify-center p-8 border rounded-md"
          >
            <div className="text-center mb-4">
              <p className="text-cyan-300 text-lg font-bold">
                {formattedDate}
              </p>
              <h2 className="text-xl font-bold text-cyan-300">Daily P&L</h2>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <p
                className={`text-5xl font-bold ${hasNoTrades ? 'text-muted-foreground' : isProfitable ? 'text-green-500' : 'text-red-500'}`}
                style={{ fontFamily: 'monospace' }}
              >
                {hasNoTrades ? '$0.00' : `${isProfitable ? '+' : '-'}${formattedPnL}`}
              </p>
            </div>

            <div className="text-center mt-4">
              <p className="text-xs text-muted-foreground">
                Shared via OnyxTech
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!imageUrl && (
            <Button
              onClick={generateImage}
              className="w-full sm:w-auto bg-none bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700"
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Image'}
            </Button>
          )}

          {imageUrl && (
            <>
              <Button
                onClick={downloadImage}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Download
              </Button>
              <Button
                onClick={shareImage}
                className="w-full sm:w-auto bg-none bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700"
              >
                Share
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 