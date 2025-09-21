
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { toast } from "@/hooks/use-toast";
import { forwardRef } from "react";

interface Props {
  selectedFile: File | null;
  uploading: boolean;
  uploadProgress: number;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export const FileUploadSection = forwardRef<HTMLInputElement, Props>(({ selectedFile, uploading, uploadProgress, onFileChange, disabled = false }, ref) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 50MB for video files)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 50MB",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }
      
      onFileChange(file);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="file" className="text-sm font-medium">File Upload</Label>
      <Input
        ref={ref}
        id="file"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.mp4,.mov,.avi,.mkv,.mp3,.wav,.flac,.aac,.ogg"
        onChange={handleFileChange}
        disabled={disabled}
        className="h-8 text-base w-full border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 file:bg-white/10 file:text-yellow-300 file:border-0 file:mr-4 file:py-1 file:px-2 file:rounded file:text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 text-center pt-1 pb-2"
        style={{ width: 'calc(100% + 15px)' }}
      />
      {/* Hidden help text - shown on hover */}
      <div className="relative group">
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center cursor-help">
          <span className="text-xs font-bold text-gray-800">?</span>
        </div>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          Allowed: PDF, Word docs, Excel files, text files, images, videos (MP4, MOV, AVI, MKV), and audio files (MP3, WAV, FLAC, AAC, OGG) - max 50MB
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      </div>
      {selectedFile && (
        <p className="text-sm text-yellow-400">Selected: {selectedFile.name}</p>
      )}
      {uploading && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Upload Progress</Label>
          <Progress value={uploadProgress} className="w-full h-2" />
        </div>
      )}
    </div>
  );
});
