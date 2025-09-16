
import { useState } from "react";
import { Evidence } from "@/types/evidence";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useExhibits } from "./useExhibits";

export const useEvidenceUpload = () => {
  const { user } = useAuth();
  const { exhibits, addExhibit, getNextExhibitNumber } = useExhibits();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File): Promise<{ fileUrl: string; fileName: string } | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    
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
    return { fileUrl: publicUrl, fileName: file.name };
  };

  const submitEvidence = async (
    formData: {
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

      // Create or find exhibit
      let exhibitId = formData.exhibitRef;
      
      // Always create or find the exhibit record
      if (formData.exhibitRef.match(/^Exhibit-\d+$/)) {
        const exhibitNumber = parseInt(formData.exhibitRef.replace('Exhibit-', ''));
        
        // First check if exhibit already exists
        const existingExhibit = exhibits.find(e => e.exhibit_number === exhibitNumber);
        
        if (existingExhibit) {
          exhibitId = existingExhibit.id;
        } else {
          // Create new exhibit
          const newExhibit = await addExhibit({
            name: formData.description || `Exhibit ${exhibitNumber}`,
            exhibit_number: exhibitNumber,
            description: formData.description || null
          });
          
          if (newExhibit) {
            exhibitId = newExhibit.id;
          } else {
            throw new Error('Failed to create exhibit');
          }
        }
      }
      
      const evidenceData = {
        exhibit_id: exhibitId,
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
