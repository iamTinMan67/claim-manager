
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
  return (
    <div className="space-y-2">
      {method === 'To-Do' && dateSubmitted && (
        <Alert className="py-2">
          <Calendar className="h-3 w-3" />
          <AlertDescription className="text-xs">
            A calendar reminder will be automatically created for {new Date(dateSubmitted).toLocaleDateString()} at 9:00 AM with an alarm.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="date-submitted" className="text-sm">Date Submitted</Label>
        <Input
          id="date-submitted"
          type="date"
          value={dateSubmitted}
          onChange={(e) => setDateSubmitted(e.target.value)}
          disabled={uploading}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="method" className="text-sm">Method</Label>
        <Select value={method} onValueChange={setMethod} disabled={uploading}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Post">Post</SelectItem>
            <SelectItem value="Email">Email</SelectItem>
            <SelectItem value="Hand">Hand</SelectItem>
            <SelectItem value="Call">Call</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="To-Do">To-Do</SelectItem>
          </SelectContent>
        </Select>
      </div>
      </div>
    </div>
  );
};
