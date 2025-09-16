
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { EditableExhibitSelector } from "../EditableExhibitSelector";

interface Props {
  exhibitRef: string;
  setExhibitRef: (value: string) => void;
  bookOfDeedsRef: string;
  setBookOfDeedsRef: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  uploading: boolean;
}

export const EvidenceFormFields = ({
  exhibitRef,
  setExhibitRef,
  bookOfDeedsRef,
  setBookOfDeedsRef,
  description,
  setDescription,
  uploading
}: Props) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter evidence description"
          disabled={uploading}
          required
          className="h-10 text-sm w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exhibit-ref" className="text-sm font-medium">Exhibit Reference</Label>
        <EditableExhibitSelector
          value={exhibitRef}
          onChange={setExhibitRef}
          disabled={uploading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="book-of-deeds-ref" className="text-sm font-medium">Book-Of-Deeds Ref #</Label>
        <Input
          id="book-of-deeds-ref"
          value={bookOfDeedsRef}
          onChange={(e) => setBookOfDeedsRef(e.target.value)}
          disabled={uploading}
          placeholder="Enter reference number"
          className="h-10 text-sm w-full"
        />
      </div>
    </>
  );
};
