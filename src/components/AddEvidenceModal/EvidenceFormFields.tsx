
import { Label } from "../ui/label";
import { Input } from "../ui/input";

interface Props {
  exhibitRef: string;
  setExhibitRef: (value: string) => void;
  bookOfDeedsRef: string;
  setBookOfDeedsRef: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  uploading: boolean;
  disabled?: boolean;
}

export const EvidenceFormFields = ({
  exhibitRef,
  setExhibitRef,
  bookOfDeedsRef,
  setBookOfDeedsRef,
  description,
  setDescription,
  uploading,
  disabled = false
}: Props) => {
  return (
    <>
      <div className="space-y-3">
        <Label htmlFor="exhibit-ref" className="text-base font-medium">Exhibit Reference</Label>
        <Input
          id="exhibit-ref"
          value={exhibitRef}
          onChange={(e) => setExhibitRef(e.target.value)}
          disabled={uploading || disabled}
          placeholder="Enter exhibit reference"
          className="h-12 text-base w-full border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="book-of-deeds-ref" className="text-base font-medium">Book-Of-Deeds Ref #</Label>
        <Input
          id="book-of-deeds-ref"
          value={bookOfDeedsRef}
          onChange={(e) => setBookOfDeedsRef(e.target.value)}
          disabled={false}
          className={`h-12 text-base w-full px-4 py-3 border border-yellow-400/30 rounded-md bg-white/10 ${bookOfDeedsRef ? 'text-yellow-300' : 'text-yellow-300'} placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 cursor-text opacity-100 disabled:opacity-100 caret-yellow-300`}
        />
      </div>
    </>
  );
};
