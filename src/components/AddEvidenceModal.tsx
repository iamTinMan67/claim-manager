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
  const [dateSubmitted, setDateSubmitted] = useState(() => {
    // Get the last selected date from localStorage, or default to today
    const lastDate = localStorage.getItem('lastEvidenceDate');
    return lastDate || new Date().toISOString().split('T')[0];
  });
  const [method, setMethod] = useState("Email");
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

  // Save date to localStorage whenever it changes
  useEffect(() => {
    if (dateSubmitted) {
      localStorage.setItem('lastEvidenceDate', dateSubmitted);
    }
  }, [dateSubmitted]);

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
    // Generate new exhibit reference
    const nextNumber = getNextExhibitNumber();
    setExhibitRef(`Exhibit-${nextNumber.toString().padStart(3, '0')}`);
    
    setNumberOfPages("");
    // Keep the last selected date instead of resetting it
    // setDateSubmitted(""); // Removed this line
    setMethod("Email");
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
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Add New Evidence</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pages, Method, and Date at the top */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="number-of-pages" className="text-sm font-medium">Pages</label>
              <input
                id="number-of-pages"
                type="number"
                value={numberOfPages}
                onChange={(e) => setNumberOfPages(e.target.value)}
                disabled={uploading}
                min="1"
                className="h-10 text-sm w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="method" className="text-sm font-medium">Method</label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={uploading}
                className="h-10 text-sm w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Post">Post</option>
                <option value="Email">Email</option>
                <option value="Hand">Hand</option>
                <option value="Call">Call</option>
                <option value="Online">Online</option>
                <option value="To-Do">To-Do</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="date-submitted" className="text-sm font-medium">Date Submitted</label>
              <input
                id="date-submitted"
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                disabled={uploading}
                className="h-10 text-sm w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <EvidenceFormFields
            exhibitRef={exhibitRef}
            setExhibitRef={setExhibitRef}
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
