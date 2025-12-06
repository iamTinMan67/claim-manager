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
          .select('exhibit_number')
          .limit(2000);
        // No need to filter by case_number since evidence table doesn't have this column
        const { data, error } = await query;
        if (error) throw error;
        let maxNum = 0;
        (data || []).forEach((row: any) => {
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

  // Debug: Log when method changes (removed to prevent interference)
  // useEffect(() => {
  //   console.log('Method changed to:', method);
  // }, [method]);

  // Debug: Log when file is selected
  useEffect(() => {
    console.log('File selected:', selectedFile?.name);
  }, [selectedFile]);

  // Auto-populate title from filename when a file is selected (keep method as Email)
  useEffect(() => {
    if (selectedFile) {
      console.log('File selected, keeping method as Email');
      console.log('File name:', selectedFile.name);
      
      // Auto-populate title from filename (remove extension, force title case)
      const fileName = selectedFile.name;
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      
      // Convert to title case (first letter of each word capitalized)
      const titleCase = nameWithoutExt
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      console.log('Setting title to:', titleCase);
      setTitle(titleCase);
    }
  }, [selectedFile]);

  const resetForm = () => {
    // Generate next exhibit reference by incrementing current number
    const currentMatch = exhibitRef.match(/(\d+)/);
    const nextNum = currentMatch ? parseInt(currentMatch[1], 10) + 1 : 1;
    setExhibitRef(`Exhibit ${nextNum}`);
    
    setNumberOfPages("");
    // Keep the last selected date instead of resetting it
    // setDateSubmitted(""); // Removed this line
    setMethod("To-Do");
    setBookOfDeedsRef("");
    setSelectedFile(null);
    // Reset title after clearing file (auto-population will handle it when new file is selected)
    setTitle("");
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
        description: '',
      },
      selectedFile,
      onAdd
    );
    
    // Reset form for new record instead of closing
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full" style={{ backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: '16px', width: 'calc(100% - 110px)', paddingTop: '8px' }}>
        <DialogHeader>
          <DialogTitle>
            {isGuest ? 'Submit Evidence for Review' : 'Add New Evidence'}
          </DialogTitle>
          <DialogDescription className="text-yellow-300">
            {isGuest
              ? 'Submit evidence for review by the claim owner'
              : 'To ensure the file you are uploading has an appropriate title that will automatically imput as the file name'}
          </DialogDescription>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-white/10 border border-yellow-400 text-yellow-400 px-2 py-1"
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
        <form onSubmit={handleSubmit} className="space-y-6" style={{ opacity: isGuest && isGuestFrozen ? 0.5 : 1, paddingTop: '12px', paddingRight: '24px', paddingBottom: '24px', paddingLeft: '24px' }}>
          {/* Row 1: File Upload, Pages */}
          <div className="grid grid-cols-5 gap-6 items-start">
            {/* File Upload */}
            <div className="space-y-2 col-span-2">
              <FileUploadSection
                ref={fileInputRef}
                selectedFile={selectedFile}
                uploading={uploading}
                uploadProgress={uploadProgress}
                onFileChange={setSelectedFile}
                disabled={isGuest && isGuestFrozen}
              />
            </div>
            <div className="space-y-2 col-span-1 flex flex-col justify-end items-end">
              <label
                htmlFor="number-of-pages"
                className="text-base font-medium self-end"
              >
                Pages
              </label>
              <input
                id="number-of-pages"
                type="number"
                value={numberOfPages}
                onChange={(e) => setNumberOfPages(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                min="1"
                className="h-8 text-base px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 mt-4"
                style={{ width: '50%' }}
              />
            </div>
          </div>

          {/* Row 2: Date, Method */}
          <div className="grid grid-cols-5 gap-6 items-start">
            <div className="space-y-2 col-span-1">
              <label htmlFor="date-submitted" className="text-base font-medium">Date Submitted</label>
              <input
                id="date-submitted"
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                className="h-8 text-base w-full px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div className="space-y-2 col-span-1 flex flex-col justify-end items-end">
              <label htmlFor="method" className="text-base font-medium self-end">Method</label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                className="h-8 text-base px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 mt-4"
                style={{ width: '50%' }}
              >
                <option value="Post">Post</option>
                <option value="Email">Email</option>
                <option value="Hand">Hand</option>
                <option value="Online">Online</option>
                <option value="To-Do">To-Do</option>
              </select>
            </div>
          </div>

          {/* Row 3: Book of Deeds, Exhibit */}
          <div className="grid grid-cols-5 gap-6 items-start">
            <div className="space-y-2 col-span-1">
              <label htmlFor="book-of-deeds-ref" className="text-base font-medium">Book-Of-Deeds #</label>
              <input
                id="book-of-deeds-ref"
                value={bookOfDeedsRef}
                onChange={(e) => setBookOfDeedsRef(e.target.value)}
                disabled={false}
                className={`h-8 text-base w-full px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 ${bookOfDeedsRef ? 'text-yellow-300' : 'text-yellow-300'} placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 cursor-text opacity-100 disabled:opacity-100 caret-yellow-300`}
              />
            </div>
            <div className="space-y-2 col-span-1">
              <label htmlFor="exhibit-ref" className="text-base font-medium">Exhibit #</label>
              <input
                id="exhibit-ref"
                value={exhibitRef}
                onChange={(e) => setExhibitRef(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                placeholder="Enter exhibit reference"
                className="h-8 text-base w-full px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              />
            </div>
          </div>

          {/* Row 4: Title and Add button */}
          <div className="grid grid-cols-5 gap-6 items-start">
            <div className="space-y-2 col-span-2">
              <label htmlFor="title" className="text-base font-medium">Title</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGuest && isGuestFrozen}
                placeholder="Evidence title"
                className="h-8 text-base w-full px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
              />
            </div>
            <div className="col-span-1 flex items-end">
              <Button className="bg-white/10 border border-green-400 text-green-400 h-8 flex items-center justify-center px-4" type="submit" disabled={uploading || (isGuest && isGuestFrozen)}>
                <Plus className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : isGuest ? "Submit for Review" : "Add"}
              </Button>
            </div>
          </div>


          
        </form>
      </DialogContent>
    </Dialog>
  );
};
