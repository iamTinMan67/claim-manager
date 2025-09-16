
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
    <div className="space-y-4">
      {method === 'To-Do' && dateSubmitted && (
        <Alert className="py-3">
          <Calendar className="h-4 w-4" />
          <AlertDescription className="text-sm">
            A calendar reminder will be automatically created for {new Date(dateSubmitted).toLocaleDateString()} at 9:00 AM with an alarm.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="date-submitted" className="text-sm font-medium">Date Submitted</Label>
        <Input
          id="date-submitted"
          type="date"
          value={dateSubmitted}
          onChange={(e) => setDateSubmitted(e.target.value)}
          disabled={uploading}
          className="h-10 text-sm w-full border border-yellow-400/30 rounded-md bg-white/10 text-white placeholder-yellow-300/70 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="method" className="text-sm font-medium">Method</Label>
        <Select value={method} onValueChange={setMethod} disabled={uploading}>
          <SelectTrigger className="h-10 text-sm w-full border border-yellow-400/30 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400">
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
