import { useState, useEffect, useRef } from "react";
import { Evidence } from "@/types/evidence";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { EvidenceFormFields } from "./AddEvidenceModal/EvidenceFormFields";
import { FileUploadSection } from "./AddEvidenceModal/FileUploadSection";
import { DateMethodFields } from "./AddEvidenceModal/DateMethodFields";
import { useEvidenceUpload } from "@/hooks/useEvidenceUpload";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onAdd: (evidence: Omit<Evidence, "id" | "claimIds">) => void;
  isGuest?: boolean;
  isGuestFrozen?: boolean;
  open?: boolean;
}

export const AddEvidenceModal = ({ onClose, onAdd, isGuest = false, isGuestFrozen = false, open = true }: Props) => {
  
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

  // Auto-generate exhibit reference when modal opens (only once)
  useEffect(() => {
    if (!hasSetInitialExhibit.current) {
      setExhibitRef("Exhibit-001");
      hasSetInitialExhibit.current = true;
    }
  }, []);

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full" style={{ backgroundColor: 'rgba(30, 58, 138, 0.9)', border: '2px solid #fbbf24', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle>
            {isGuest ? 'Submit Evidence for Review' : 'Add New Evidence'}
          </DialogTitle>
          <DialogDescription>
            {isGuest ? 'Submit evidence for review by the claim owner' : 'Add new evidence to your case file'}
          </DialogDescription>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            style={{ zIndex: 1000 }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>
        {isGuest && (
          <div className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm mb-4">
            Your evidence will be submitted for review by the claim owner before being added to the case.
          </div>
        )}
        {isGuest && isGuestFrozen && (
          <div className="bg-red-100 text-red-800 px-3 py-2 rounded-lg text-sm mb-4">
            Access Frozen - You cannot add evidence at this time.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6 p-6" style={{ opacity: isGuest && isGuestFrozen ? 0.5 : 1 }}>
          {/* Pages, Method, and Date at the top */}
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-3">
              <label htmlFor="number-of-pages" className="text-base font-medium">Pages</label>
              <input
                id="number-of-pages"
                type="number"
                value={numberOfPages}
                onChange={(e) => setNumberOfPages(e.target.value)}
                disabled={uploading || (isGuest && isGuestFrozen)}
                min="1"
                className="h-12 text-base w-full px-4 py-3 border border-yellow-400/30 rounded-md bg-white/10 text-white placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              />
            </div>
            
            <div className="space-y-3">
              <label htmlFor="method" className="text-base font-medium">Method</label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={uploading || (isGuest && isGuestFrozen)}
                className="h-12 text-base w-full px-4 py-3 border border-yellow-400/30 rounded-md bg-white/10 text-white placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              >
                <option value="Post">Post</option>
                <option value="Email">Email</option>
                <option value="Hand">Hand</option>
                <option value="Call">Call</option>
                <option value="Online">Online</option>
                <option value="To-Do">To-Do</option>
              </select>
            </div>
            
            <div className="space-y-3">
              <label htmlFor="date-submitted" className="text-base font-medium">Date Submitted</label>
              <input
                id="date-submitted"
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                disabled={uploading || (isGuest && isGuestFrozen)}
                className="h-12 text-base w-full px-4 py-3 border border-yellow-400/30 rounded-md bg-white/10 text-white placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
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
            disabled={isGuest && isGuestFrozen}
          />

          <FileUploadSection
            ref={fileInputRef}
            selectedFile={selectedFile}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onFileChange={setSelectedFile}
            disabled={isGuest && isGuestFrozen}
          />

          <div className="flex justify-between space-x-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Close
            </Button>
            <Button type="submit" disabled={uploading || (isGuest && isGuestFrozen)}>
              {uploading ? "Uploading..." : isGuest ? "Submit for Review" : "Save & Add Another"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
