
import { useState } from "react";
import { Evidence } from "@/types/evidence";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export const useEvidenceUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const sanitizeFileName = (name: string): string => {
    const trimmed = name.trim().toLowerCase(); // Convert to lowercase for storage
    const replaced = trimmed.replace(/[^a-z0-9._-]+/g, '-');
    return replaced.replace(/-+/g, '-');
  };

  const uploadFile = async (file: File): Promise<{ fileUrl: string; fileName: string } | null> => {
    if (!user) return null;

    const originalExt = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const safeBase = sanitizeFileName(baseName) || 'file';
    const safeName = `${safeBase}-${Date.now()}${originalExt}`;
    const filePath = `${user.id}/${safeName}`;
    
    setUploadProgress(25);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('evidence-files')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast({
        title: "Upload Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      return null;
    }

    setUploadProgress(75);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('evidence-files')
      .getPublicUrl(filePath);

    setUploadProgress(100);
    return { fileUrl: publicUrl, fileName: file.name }; // Store original filename case
  };

  const submitEvidence = async (
    formData: {
      title: string;
      exhibitRef: string;
      numberOfPages: string;
      dateSubmitted: string;
      method: string;
      urlLink: string;
      bookOfDeedsRef: string;
      description: string;
    },
    selectedFile: File | null,
    onAdd: (evidence: Omit<Evidence, "id" | "claimIds" | "display_order">) => void
  ) => {
    if (!user) {
      return;
    }
    
    console.log('submitEvidence called with method:', formData.method);
    setUploading(true);
    
    try {
      let fileUrl = null;
      let fileName = null;

      // Upload file if selected
      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        if (!uploadResult) {
          setUploading(false);
          return;
        }
        fileUrl = uploadResult.fileUrl;
        fileName = uploadResult.fileName;
      }

      // Extract exhibit number from exhibit reference (e.g., "Exhibit 1" -> 1)
      const exhibitRef = formData.exhibitRef;
      const exhibitNumberMatch = exhibitRef.match(/(\d+)/);
      const exhibitNumber = exhibitNumberMatch ? parseInt(exhibitNumberMatch[1], 10) : null;
      
      const evidenceData = {
        title: formData.title || "Untitled Evidence",
        exhibit_number: exhibitNumber,
        file_name: fileName,
        file_url: fileUrl,
        number_of_pages: formData.numberOfPages ? parseInt(formData.numberOfPages) : null,
        date_submitted: formData.dateSubmitted || null,
        method: formData.method || null,
        url_link: formData.urlLink || null,
        book_of_deeds_ref: formData.bookOfDeedsRef || null,
        description: formData.description || null,
        created_at: "",
        updated_at: "",
      };
      
      console.log('Evidence data being passed to onAdd:', evidenceData);
      onAdd(evidenceData);
    } catch (error) {
      console.error('Error in form submission:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploading,
    uploadProgress,
    submitEvidence,
  };
};
