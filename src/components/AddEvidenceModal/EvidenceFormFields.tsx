
import { Label } from "../ui/label";
import { Input } from "../ui/input";

interface Props {
  exhibitRef: string;
  setExhibitRef: (value: string) => void;
  bookOfDeedsRef: string;
  setBookOfDeedsRef: (value: string) => void;
  isGuest: boolean;
  isGuestFrozen: boolean;
}

export const EvidenceFormFields = ({
  exhibitRef,
  setExhibitRef,
  bookOfDeedsRef,
  setBookOfDeedsRef,
  isGuest,
  isGuestFrozen
}: Props) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <Label htmlFor="book-of-deeds-ref" className="text-base font-medium">Book-Of-Deeds #</Label>
        <Input
          id="book-of-deeds-ref"
          value={bookOfDeedsRef}
          onChange={(e) => setBookOfDeedsRef(e.target.value)}
          disabled={false}
          className={`h-8 text-base px-3 py-2 border border-yellow-400/30 rounded-md bg-white/10 ${bookOfDeedsRef ? 'text-yellow-300' : 'text-yellow-300'} placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 cursor-text opacity-100 disabled:opacity-100 caret-yellow-300`}
          style={{ width: 'calc(100% + 6px)' }}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="exhibit-ref" className="text-base font-medium">Exhibit #</Label>
        <Input
          id="exhibit-ref"
          value={exhibitRef}
          onChange={(e) => setExhibitRef(e.target.value)}
          disabled={isGuest && isGuestFrozen}
          placeholder="Enter exhibit reference"
          className="h-8 text-base px-3 pt-1 pb-2 border border-yellow-400/30 rounded-md bg-white/10 text-yellow-300 placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
          style={{ width: 'calc(100% - 6px)', marginLeft: '3px' }}
        />
      </div>
    </div>
  );
};
