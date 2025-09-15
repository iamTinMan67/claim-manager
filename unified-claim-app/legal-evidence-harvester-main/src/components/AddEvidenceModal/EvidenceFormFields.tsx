
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { EditableExhibitSelector } from "../EditableExhibitSelector";

interface Props {
  exhibitRef: string;
  setExhibitRef: (value: string) => void;
  numberOfPages: string;
  setNumberOfPages: (value: string) => void;
  urlLink: string;
  setUrlLink: (value: string) => void;
  bookOfDeedsRef: string;
  setBookOfDeedsRef: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  uploading: boolean;
}

export const EvidenceFormFields = ({
  exhibitRef,
  setExhibitRef,
  numberOfPages,
  setNumberOfPages,
  urlLink,
  setUrlLink,
  bookOfDeedsRef,
  setBookOfDeedsRef,
  description,
  setDescription,
  uploading
}: Props) => {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="description" className="text-sm">Description *</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter evidence description"
          disabled={uploading}
          required
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="exhibit-ref" className="text-sm">Exhibit Reference</Label>
        <EditableExhibitSelector
          value={exhibitRef}
          onChange={setExhibitRef}
          disabled={uploading}
        />
      </div>

      <div className="grid grid-cols-12 gap-2">
        {/* Pages takes 25% width */}
        <div className="col-span-3 space-y-1">
          <Label htmlFor="number-of-pages" className="text-sm">Pages</Label>
          <Input
            id="number-of-pages"
            type="number"
            value={numberOfPages}
            onChange={(e) => setNumberOfPages(e.target.value)}
            disabled={uploading}
            min="1"
            className="h-8 text-sm"
          />
        </div>
        
        {/* Book-Of-Deeds Ref # takes remaining 75% width */}
        <div className="col-span-9 space-y-1">
          <Label htmlFor="book-of-deeds-ref" className="text-sm">Book-Of-Deeds Ref #</Label>
          <Input
            id="book-of-deeds-ref"
            value={bookOfDeedsRef}
            onChange={(e) => setBookOfDeedsRef(e.target.value)}
            disabled={uploading}
            placeholder="Enter reference number"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="url-link" className="text-sm">URL Link (Optional)</Label>
        <Input
          id="url-link"
          type="url"
          value={urlLink}
          onChange={(e) => setUrlLink(e.target.value)}
          placeholder="https://example.com"
          disabled={uploading}
          className="h-8 text-sm"
        />
      </div>
    </>
  );
};
