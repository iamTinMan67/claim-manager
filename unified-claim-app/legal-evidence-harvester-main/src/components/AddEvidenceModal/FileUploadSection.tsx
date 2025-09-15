
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { toast } from "@/hooks/use-toast";

interface Props {
  selectedFile: File | null;
  uploading: boolean;
  uploadProgress: number;
  onFileChange: (file: File | null) => void;
}

export const FileUploadSection = ({ selectedFile, uploading, uploadProgress, onFileChange }: Props) => {
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
    <div className="space-y-0.5">
      <Label htmlFor="file" className="text-xs">File Upload</Label>
      <Input
        id="file"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.mp4,.mov,.avi,.mkv,.mp3,.wav,.flac,.aac,.ogg"
        onChange={handleFileChange}
        disabled={uploading}
        className="h-6 text-xs w-full"
      />
      <p className="text-xs text-gray-500">
        Allowed: PDF, Word docs, Excel files, text files, images, videos (MP4, MOV, AVI, MKV), and audio files (MP3, WAV, FLAC, AAC, OGG) - max 50MB
      </p>
      {selectedFile && (
        <p className="text-xs text-green-600">Selected: {selectedFile.name}</p>
      )}
      {uploading && (
        <div className="space-y-0.5">
          <Label className="text-xs">Upload Progress</Label>
          <Progress value={uploadProgress} className="w-full h-1" />
        </div>
      )}
    </div>
  );
};
