import { useState, useEffect, useRef } from "react";
import { Evidence } from "@/types/evidence";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { EvidenceFormFields } from "./AddEvidenceModal/EvidenceFormFields";
import { FileUploadSection } from "./AddEvidenceModal/FileUploadSection";
import { DateMethodFields } from "./AddEvidenceModal/DateMethodFields";
import { useEvidenceUpload } from "@/hooks/useEvidenceUpload";
import { useExhibits } from "@/hooks/useExhibits";

interface Props {
  onClose: () => void;
  onAdd: (evidence: Omit<Evidence, "id" | "claimIds">) => void;
}

export const AddEvidenceModal = ({ onClose, onAdd }: Props) => {
  
  const [exhibitRef, setExhibitRef] = useState(""); // This will be auto-generated
  const [numberOfPages, setNumberOfPages] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState("");
  const [method, setMethod] = useState("Email");
  const [urlLink, setUrlLink] = useState("");
  const [bookOfDeedsRef, setBookOfDeedsRef] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const hasSetInitialExhibit = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploading, uploadProgress, submitEvidence } = useEvidenceUpload();
  const { exhibits, getNextExhibitNumber, addExhibit } = useExhibits();

  // Auto-generate exhibit reference when modal opens (only once)
  useEffect(() => {
    if (!hasSetInitialExhibit.current && exhibits.length >= 0) {
      if (exhibits.length === 0) {
        setExhibitRef("Exhibit-001");
      } else {
        const nextNumber = getNextExhibitNumber();
        setExhibitRef(`Exhibit-${nextNumber.toString().padStart(3, '0')}`);
      }
      hasSetInitialExhibit.current = true;
    }
  }, [exhibits, getNextExhibitNumber]);

  // Debug: Log when method changes
  useEffect(() => {
    console.log('Method changed to:', method);
  }, [method]);

  // Debug: Log when file is selected
  useEffect(() => {
    console.log('File selected:', selectedFile?.name);
  }, [selectedFile]);

  // Auto-set method to "Online" when a file is selected
  useEffect(() => {
    if (selectedFile && method !== 'Online') {
      console.log('File selected, changing method to Online');
      setMethod('Online');
    }
  }, [selectedFile, method]);

  const resetForm = () => {
    setExhibitRef("");
    setNumberOfPages("");
    setDateSubmitted("");
    setMethod("Email");
    setUrlLink("");
    setBookOfDeedsRef("");
    setDescription("");
    setSelectedFile(null);
    hasSetInitialExhibit.current = false;
    
    // Focus the file input after a short delay to ensure form is reset
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.focus();
      }
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await submitEvidence(
      {
        exhibitRef,
        numberOfPages,
        dateSubmitted,
        method,
        urlLink,
        bookOfDeedsRef,
        description,
      },
      selectedFile,
      onAdd
    );
    
    // Reset form for new record instead of closing
    resetForm();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[200px] w-full">
        <DialogHeader>
          <DialogTitle>Add New Evidence</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-1">
          <EvidenceFormFields
            exhibitRef={exhibitRef}
            setExhibitRef={setExhibitRef}
            numberOfPages={numberOfPages}
            setNumberOfPages={setNumberOfPages}
            urlLink={urlLink}
            setUrlLink={setUrlLink}
            bookOfDeedsRef={bookOfDeedsRef}
            setBookOfDeedsRef={setBookOfDeedsRef}
            description={description}
            setDescription={setDescription}
            uploading={uploading}
          />

          <FileUploadSection
            ref={fileInputRef}
            selectedFile={selectedFile}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onFileChange={setSelectedFile}
          />

          <DateMethodFields
            dateSubmitted={dateSubmitted}
            setDateSubmitted={setDateSubmitted}
            method={method}
            setMethod={setMethod}
            uploading={uploading}
          />

          <div className="flex justify-between space-x-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Close
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Save & Add Another"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
