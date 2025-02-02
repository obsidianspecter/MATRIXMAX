import { useState } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";

interface TextRecognitionProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onTextRecognized: (text: string) => void;
}

export default function TextRecognition({ canvasRef, onTextRecognized }: TextRecognitionProps) {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>('');

  const recognizeText = async () => {
    if (!canvasRef.current || isRecognizing) return;

    setIsRecognizing(true);
    const worker = await createWorker('eng');

    try {
      setLoadingPhase('Preparing canvas');
      // Create a temporary canvas with white background
      const tempCanvas = document.createElement('canvas');
      const canvas = canvasRef.current;
      
      // Set the same dimensions as the original canvas
      const width = canvas.width;
      const height = canvas.height;
      tempCanvas.width = width;
      tempCanvas.height = height;
      
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        throw new Error('Could not get canvas context');
      }

      await new Promise(resolve => setTimeout(resolve, 500)); // Add slight delay for effect
      setLoadingPhase('Enhancing image');

      // Set white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, width, height);
      
      // Draw the original canvas content with inverted colors for better contrast
      tempCtx.globalCompositeOperation = 'difference';
      tempCtx.drawImage(canvas, 0, 0);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoadingPhase('Processing image');

      // Convert to grayscale
      const imageData = tempCtx.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      
      for (let i = 0; i < pixels.length; i += 4) {
        const lightness = parseInt(((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3).toString());
        pixels[i] = lightness;
        pixels[i + 1] = lightness;
        pixels[i + 2] = lightness;
      }
      
      tempCtx.putImageData(imageData, 0, 0);

      await new Promise(resolve => setTimeout(resolve, 500));
      setLoadingPhase('Initializing recognition');

      // Initialize Tesseract
      await worker.reinitialize();
      
      setLoadingPhase('Analyzing handwriting');
      // Set parameters for better handwriting recognition
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-_\'"\n ',
      });

      setLoadingPhase('Converting to text');
      // Recognize text
      const { data } = await worker.recognize(tempCanvas.toDataURL('image/png'));
      
      if (data.text && data.text.trim()) {
        onTextRecognized(data.text.trim());
      } else {
        onTextRecognized("No text was recognized. Please write more clearly and try again.");
      }

    } catch (error) {
      console.error('Text recognition error:', error);
      onTextRecognized("An error occurred during text recognition. Please try again.");
    } finally {
      await worker.terminate();
      setIsRecognizing(false);
      setLoadingPhase('');
    }
  };

  return (
    <Button
      onClick={recognizeText}
      disabled={isRecognizing}
      variant="outline"
      className="relative border-border text-foreground hover:bg-secondary/80 flex items-center gap-2 min-w-[140px] overflow-hidden group"
    >
      {isRecognizing ? (
        <>
          <div className="absolute inset-0 bg-secondary/20 animate-pulse" />
          <div className="flex items-center gap-2 z-10">
            <div className="relative w-4 h-4">
              <Loader2 className="h-4 w-4 animate-spin absolute" />
              <Wand2 className="h-4 w-4 animate-pulse absolute" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs opacity-70">Processing</span>
              <span className="text-[10px] opacity-50">{loadingPhase}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <Wand2 className="h-4 w-4 group-hover:animate-bounce" />
          Convert to Text
        </>
      )}
    </Button>
  );
} 