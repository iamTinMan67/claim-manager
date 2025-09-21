import { useState, useEffect, useRef } from "react";
import { Evidence } from "@/types/evidence";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { EvidenceFormFields } from "./AddEvidenceModal/EvidenceFormFields";
import { FileUploadSection } from "./AddEvidenceModal/FileUploadSection";
import { useEvidenceUpload } from "@/hooks/useEvidenceUpload";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onClose: () => void;
  onAdd: (evidence: Omit<Evidence, "id" | "claimIds">) => void;
  isGuest?: boolean;
  isGuestFrozen?: boolean;
  open?: boolean;
  selectedClaim?: string | null;
  initialExhibitRef?: string;
}

export const AddEvidenceModal = ({ onClose, onAdd, isGuest = false, isGuestFrozen = false, open = true, selectedClaim = null, initialExhibitRef }: Props) => {
  
  const [title, setTitle] = useState(""); // Title field for evidence
  const [exhibitRef, setExhibitRef] = useState(""); // This will be auto-generated
  const [numberOfPages, setNumberOfPages] = useState("1");
  const [dateSubmitted, setDateSubmitted] = useState(() => {
    // Get the last selected date from localStorage, or default to today
    const lastDate = localStorage.getItem('lastEvidenceDate');
    return lastDate || new Date().toISOString().split('T')[0];
  });
  const [method, setMethod] = useState("Email");
  const [urlLink, setUrlLink] = useState("");
  const PLACEHOLDER_REF = "Enter any Reference #";
  const [bookOfDeedsRef, setBookOfDeedsRef] = useState(PLACEHOLDER_REF);
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const hasSetInitialExhibit = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploading, uploadProgress, submitEvidence } = useEvidenceUpload();

  // Auto-generate exhibit reference when modal opens (only once)
  useEffect(() => {
    const initExhibit = async () => {
      if (hasSetInitialExhibit.current || !open) return;
      // If parent provided a precomputed exhibit ref, use it directly
      if (initialExhibitRef) {
        setExhibitRef(initialExhibitRef)
        hasSetInitialExhibit.current = true
        return
      }
      try {
        let query = supabase
          .from('evidence')
          .select('exhibit_id, exhibit_number')
          .limit(2000);
        // No need to filter by case_number since evidence table doesn't have this column
        const { data, error } = await query;
        if (error) throw error;
        let maxNum = 0;
        (data || []).forEach((row: any) => {
          const ref: string = row.exhibit_id || '';
          const match = ref.match(/exhibit[-\s_]*(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
          }
          if (row.exhibit_number && Number.isFinite(row.exhibit_number)) {
            maxNum = Math.max(maxNum, Number(row.exhibit_number));
          }
        });
        setExhibitRef(`Exhibit ${maxNum + 1}`);
      } catch (_) {
        setExhibitRef("Exhibit 1");
      } finally {
        hasSetInitialExhibit.current = true;
      }
    };
    initExhibit();
  }, [open, selectedClaim, initialExhibitRef]);

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

  // Auto-set method to "Online" and populate title from filename when a file is selected
  useEffect(() => {
    if (selectedFile) {
      console.log('File selected, changing method to Online');
      setMethod('Online');
      
      // Auto-populate title from filename (remove extension)
      const fileName = selectedFile.name;
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  }, [selectedFile]);

  const resetForm = () => {
    // Generate next exhibit reference by incrementing current number
    const currentMatch = exhibitRef.match(/(\d+)/);
    const nextNum = currentMatch ? parseInt(currentMatch[1], 10) + 1 : 1;
    setExhibitRef(`Exhibit ${nextNum}`);
    
    setTitle(""); // Reset title field
    setNumberOfPages("");
    // Keep the last selected date instead of resetting it
    // setDateSubmitted(""); // Removed this line
    setMethod("To-Do");
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
    
    const normalizedRef = bookOfDeedsRef === PLACEHOLDER_REF ? "" : bookOfDeedsRef;
    await submitEvidence(
      {
        title,
        exhibitRef,
        numberOfPages,
        dateSubmitted,
        method,
        urlLink: urlLink || '',
        bookOfDeedsRef: normalizedRef,
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
          <DialogDescription className="text-yellow-300">
            {isGuest
              ? 'Submit evidence for review by the claim owner'
              : 'To ensure the file you are uploading has an appropriate title that the application will automatically imput as the file name'}
          </DialogDescription>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-white/10 border border-red-400 text-red-400 px-2 py-1"
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
          {/* Row 1: File Upload (2/6), Title (2/6), Pages (1/6), Method (1/6) */}
          <div className="grid grid-cols-6 gap-6 items-start">
            {/* File Upload */}
            <div className="space-y-3 col-span-2">
              <FileUploadSection
                ref={fileInputRef}
                selectedFile={selectedFile}
                uploading={uploading}
                uploadProgress={uploadProgress}
                onFileChange={setSelectedFile}
                disabled={isGuest && isGuestFrozen}
              />
            </div>
            
            {/* Title field */}
            <div className="space-y-2 col-span-2">
              <label htmlFor="title" className="text-base font-medium">Title</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                placeholder="Evidence title"
                className="h-8 text-base w-full px-3 py-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              />
            </div>
            <div className="space-y-2 col-span-1">
              <label htmlFor="number-of-pages" className="text-base font-medium">Pages</label>
              <input
                id="number-of-pages"
                type="number"
                value={numberOfPages}
                onChange={(e) => setNumberOfPages(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                min="1"
                className="h-8 text-base w-full px-3 py-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              />
            </div>
            
            <div className="space-y-2 col-span-1">
              <label htmlFor="method" className="text-base font-medium">Method</label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                className="h-8 text-base w-full px-3 py-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              >
                <option value="Post">Post</option>
                <option value="Email">Email</option>
                <option value="Hand">Hand</option>
                
                <option value="Online">Online</option>
                <option value="To-Do">To-Do</option>
              </select>
            </div>
          </div>

          {/* Row 2: Date, Exhibit, Book of Deeds (3 columns) */}
          <div className="grid grid-cols-3 gap-6 items-start">
            <div className="space-y-3">
              <label htmlFor="date-submitted" className="text-base font-medium">Date Submitted</label>
              <input
                id="date-submitted"
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                className="h-8 text-base w-full px-3 py-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              />
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
          </div>

          {/* Row 3: Description label, then textarea + actions aligned to textarea edges */}
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-3">
              <label htmlFor="description" className="text-base font-medium">Description</label>
            </div>
            <div className="col-span-3 grid grid-cols-5 gap-6 items-stretch">
              <div className="col-span-2">
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter evidence description"
                  disabled={isGuest && isGuestFrozen}
                  rows={2}
                  className="text-base w-full px-4 py-3 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 h-full"
                />
              </div>
              <div className="h-full flex flex-col items-end justify-between">
                <Button className="bg-white/10 border border-green-400 text-green-400 min-w-[100px] w-2/5 h-8 flex items-center justify-center" type="submit" disabled={uploading || (isGuest && isGuestFrozen)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {uploading ? "Uploading..." : isGuest ? "Submit for Review" : "Add"}
                </Button>
                <Button className="bg-white/10 border border-red-400 text-red-400 min-w-[100px] w-2/5 h-8 flex items-center justify-center" onClick={onClose} disabled={uploading}>
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          </div>

          
        </form>
      </DialogContent>
    </Dialog>
  );
};
