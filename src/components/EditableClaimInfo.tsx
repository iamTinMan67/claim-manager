
import { useState } from "react";
import { Claim } from "@/hooks/useClaims";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Edit, Save, X } from "lucide-react";

interface Props {
  claim: Claim;
  onUpdate: (claimId: string, updates: Partial<Claim>) => void;
}

export const EditableClaimInfo = ({ claim, onUpdate }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedClaim, setEditedClaim] = useState(claim);

  const handleSave = () => {
    onUpdate(claim.case_number, {
      case_number: editedClaim.case_number,
      court: editedClaim.court,
      plaintiff_name: editedClaim.plaintiff_name,
      defendant_name: editedClaim.defendant_name,
      status: editedClaim.status,
      description: editedClaim.description
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedClaim(claim);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-blue-50 p-6 rounded-lg mb-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-blue-900">{claim.title}</h2>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="text-gray-600 hover:text-gray-700"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="flex flex-col">
            <label className="font-medium text-blue-800 mb-1">Case:</label>
            <Input
              value={editedClaim.case_number}
              onChange={(e) => setEditedClaim({ ...editedClaim, case_number: e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="font-medium text-blue-800 mb-1">Court:</label>
            <Input
              value={editedClaim.court || ''}
              onChange={(e) => setEditedClaim({ ...editedClaim, court: e.target.value })}
              placeholder="N/A"
              className="text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="font-medium text-blue-800 mb-1">Status:</label>
            <Select
              value={editedClaim.status}
              onValueChange={(value) => setEditedClaim({ ...editedClaim, status: value as Claim["status"] })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <label className="font-medium text-blue-800 mb-1">Plaintiff:</label>
            <Input
              value={editedClaim.plaintiff_name || ''}
              onChange={(e) => setEditedClaim({ ...editedClaim, plaintiff_name: e.target.value })}
              placeholder="N/A"
              className="text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="font-medium text-blue-800 mb-1">Defendant:</label>
            <Input
              value={editedClaim.defendant_name || ''}
              onChange={(e) => setEditedClaim({ ...editedClaim, defendant_name: e.target.value })}
              placeholder="N/A"
              className="text-sm"
            />
          </div>
        </div>
        
        {(claim.description || isEditing) && (
          <div className="mt-4">
            <label className="font-medium text-blue-800 block mb-1">Description:</label>
            <Textarea
              value={editedClaim.description || ''}
              onChange={(e) => setEditedClaim({ ...editedClaim, description: e.target.value })}
              className="text-sm min-h-[100px]"
              placeholder="Enter claim description..."
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 p-6 rounded-lg mb-8">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold text-blue-900">{claim.title}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <div className="flex flex-wrap">
          <span className="font-medium text-blue-800 mr-2">Case:</span>
          <span className="text-blue-700">{claim.case_number}</span>
        </div>
        <div className="flex flex-wrap">
          <span className="font-medium text-blue-800 mr-2">Court:</span>
          <span className="text-blue-700">{claim.court || 'N/A'}</span>
        </div>
        <div className="flex flex-wrap">
          <span className="font-medium text-blue-800 mr-2">Status:</span>
          <span className="text-blue-700">{claim.status}</span>
        </div>
        <div className="flex flex-wrap">
          <span className="font-medium text-blue-800 mr-2">Plaintiff:</span>
          <span className="text-blue-700">{claim.plaintiff_name || 'N/A'}</span>
        </div>
        <div className="flex flex-wrap">
          <span className="font-medium text-blue-800 mr-2">Defendant:</span>
          <span className="text-blue-700">{claim.defendant_name || 'N/A'}</span>
        </div>
      </div>
      
      {claim.description && (
        <div className="mt-4">
          <span className="font-medium text-blue-800">Description:</span>
          <p className="text-blue-700 mt-1">{claim.description}</p>
        </div>
      )}
    </div>
  );
};
