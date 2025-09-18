import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useExhibits } from "@/hooks/useExhibits";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onCreateNew?: () => void;
}

export const ExhibitSelector = ({ value, onChange, disabled, onCreateNew }: Props) => {
  const { exhibits, loading } = useExhibits();

  const formatExhibitDisplay = (exhibit: any) => {
    const number = `Exhibit-${exhibit.exhibit_number.toString().padStart(3, '0')}`;
    return `${number}: ${exhibit.name}`;
  };

  const formatExhibitValue = (exhibit: any) => {
    return exhibit.id;
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading exhibits..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select an exhibit" />
          </SelectTrigger>
          <SelectContent>
            {exhibits.map((exhibit) => (
              <SelectItem key={exhibit.id} value={formatExhibitValue(exhibit)}>
                {formatExhibitDisplay(exhibit)}
              </SelectItem>
            ))}
            {exhibits.length === 0 && (
              <SelectItem value="no-exhibits" disabled>
                No exhibits available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {onCreateNew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCreateNew}
            disabled={disabled}
            title="Create new exhibit"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>
      {exhibits.length === 0 && (
        <p className="text-sm text-gray-500">
          No exhibits found. Create your first exhibit to organize your evidence.
        </p>
      )}
    </div>
  );
};