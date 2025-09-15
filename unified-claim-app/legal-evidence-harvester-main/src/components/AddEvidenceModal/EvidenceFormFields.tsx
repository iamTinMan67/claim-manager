
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { ExhibitSelector } from "../ExhibitSelector";

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
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter evidence description"
          disabled={uploading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exhibit-ref">Exhibit Reference</Label>
        <ExhibitSelector
          value={exhibitRef}
          onChange={setExhibitRef}
          disabled={uploading}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Pages takes 25% width */}
        <div className="col-span-3 space-y-2">
          <Label htmlFor="number-of-pages">Pages</Label>
          <Input
            id="number-of-pages"
            type="number"
            value={numberOfPages}
            onChange={(e) => setNumberOfPages(e.target.value)}
            disabled={uploading}
            min="1"
          />
        </div>
        
        {/* Book-Of-Deeds Ref # takes remaining 75% width */}
        <div className="col-span-9 space-y-2">
          <Label htmlFor="book-of-deeds-ref">Book-Of-Deeds Ref #</Label>
          <Input
            id="book-of-deeds-ref"
            value={bookOfDeedsRef}
            onChange={(e) => setBookOfDeedsRef(e.target.value)}
            disabled={uploading}
            placeholder="Enter reference number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url-link">URL Link (Optional)</Label>
        <Input
          id="url-link"
          type="url"
          value={urlLink}
          onChange={(e) => setUrlLink(e.target.value)}
          placeholder="https://example.com"
          disabled={uploading}
        />
      </div>
    </>
  );
};
