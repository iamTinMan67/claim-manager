
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Alert, AlertDescription } from "../ui/alert";
import { Calendar, Clock } from "lucide-react";

interface Props {
  dateSubmitted: string;
  setDateSubmitted: (value: string) => void;
  method: string;
  setMethod: (value: string) => void;
  uploading: boolean;
}

export const DateMethodFields = ({
  dateSubmitted,
  setDateSubmitted,
  method,
  setMethod,
  uploading
}: Props) => {
  // Set default method to "To-Do" if not already set
  if (!method) {
    setMethod("To-Do");
  }
  return (
    <div className="space-y-4">
      {method === 'To-Do' && dateSubmitted && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            A calendar reminder will be automatically created for {new Date(dateSubmitted).toLocaleDateString()} at 9:00 AM with an alarm.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="date-submitted">Date Submitted</Label>
        <Input
          id="date-submitted"
          type="date"
          value={dateSubmitted}
          onChange={(e) => setDateSubmitted(e.target.value)}
          disabled={uploading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="method">Method</Label>
        <Select value={method} onValueChange={setMethod} disabled={uploading}>
          <SelectTrigger>
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Post">Post</SelectItem>
            <SelectItem value="Email">Email</SelectItem>
            <SelectItem value="Hand">Hand</SelectItem>
            <SelectItem value="Call">Call</SelectItem>
            <SelectItem value="To-Do">To-Do</SelectItem>
          </SelectContent>
        </Select>
      </div>
      </div>
    </div>
  );
};
