import { useState, useEffect } from "react";
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

  const { uploading, uploadProgress, submitEvidence } = useEvidenceUpload();
  const { exhibits, getNextExhibitNumber, addExhibit } = useExhibits();

  // Auto-generate exhibit reference when modal opens
  useEffect(() => {
    if (exhibits.length === 0) {
      setExhibitRef("Exhibit-001");
    } else {
      const nextNumber = getNextExhibitNumber();
      setExhibitRef(`Exhibit-${nextNumber.toString().padStart(3, '0')}`);
    }
  }, [exhibits, getNextExhibitNumber]);

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
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Evidence</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Save Evidence"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
