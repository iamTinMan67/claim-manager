
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
        disabled={uploading || disabled}
        className="h-10 text-sm w-full border border-yellow-400/30 rounded-md bg-white/10 text-white file:bg-white/10 file:text-white file:border-0 file:mr-4 file:py-1 file:px-2 file:rounded file:text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
      />
      <p className="text-sm text-yellow-300/70">
        Allowed: PDF, Word docs, Excel files, text files, images, videos (MP4, MOV, AVI, MKV), and audio files (MP3, WAV, FLAC, AAC, OGG) - max 50MB
      </p>
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
