
import { useState } from "react";
import { Evidence } from "@/types/evidence";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, X, File } from "lucide-react";

interface Props {
  evidence: Evidence;
  onClose: () => void;
  onUpdate: (evidenceId: string, updates: Partial<Evidence>) => void;
}

export const EditEvidenceFileModal = ({ evidence, onClose, onUpdate }: Props) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemoveCurrentFile = async () => {
    if (!evidence.file_url) return;

    setUploading(true);
    try {
      await onUpdate(evidence.id, {
        file_name: null,
        file_url: null,
      });

      toast({
        title: "File Removed",
        description: "The file has been removed from this evidence item.",
      });
      onClose();
    } catch (error) {
      console.error('Error removing file:', error);
      toast({
        title: "Error",
        description: "Failed to remove file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceFile = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadProgress(25);

    try {
      // Upload new file
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidence-files')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(75);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('evidence-files')
        .getPublicUrl(filePath);

      setUploadProgress(100);

      // Update evidence with new file
      await onUpdate(evidence.id, {
        file_name: selectedFile.name,
        file_url: publicUrl,
      });

      toast({
        title: "File Updated",
        description: "The file has been successfully replaced.",
      });
      onClose();
    } catch (error) {
      console.error('Error replacing file:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload new file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Evidence File</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current File Info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current File</Label>
            {evidence.file_name ? (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <File className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">{evidence.file_name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveCurrentFile}
                  disabled={uploading}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 p-3 border rounded-lg">No file attached</p>
            )}
          </div>

          {/* Upload New File */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {evidence.file_name ? "Replace with New File" : "Add New File"}
            </Label>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <div className="mt-2">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-sm text-blue-600 hover:text-blue-700">
                      Click to select a file
                    </span>
                    <Input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={uploading}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    />
                  </Label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, DOC, TXT, or image files
                </p>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {uploading && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            {selectedFile && (
              <Button 
                onClick={handleReplaceFile}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? "Uploading..." : evidence.file_name ? "Replace File" : "Add File"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
