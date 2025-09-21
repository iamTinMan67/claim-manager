
import { useState } from "react";
import { Claim } from "@/hooks/useClaims";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

interface Props {
  onClose: () => void;
  onAdd: (claim: Omit<Claim, "id" | "created_at" | "updated_at">) => void;
}

export const AddClaimModal = ({ onClose, onAdd }: Props) => {
  const [claim, setClaim] = useState<Omit<Claim, "id" | "created_at" | "updated_at">>({
    title: "",
    case_number: "",
    court: "",
    plaintiff_name: "",
    defendant_name: "",
    description: "",
    status: "Active"
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    
    // Validate required fields
    const errors: {[key: string]: string} = {};
    
    if (!claim.title.trim()) {
      errors.title = 'Claim Title is required';
    }
    
    if (!claim.case_number.trim()) {
      errors.case_number = 'Case Number is required';
    }
    
    // If there are validation errors, set them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    // Ensure description is not null/undefined, use empty string if not provided
    const claimData = {
      ...claim,
      description: claim.description || ''
    };
    
    onAdd(claimData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Claim</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Claim Title *</Label>
              <Input
                id="title"
                value={claim.title}
                onChange={(e) => {
                  setClaim({ ...claim, title: e.target.value });
                  clearError('title');
                }}
                placeholder="e.g., Property Damage Claim"
                className={formErrors.title ? 'border-red-500 focus:border-red-500' : ''}
              />
              {formErrors.title && (
                <p className="text-red-500 text-sm">{formErrors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={claim.status}
                onValueChange={(value) => setClaim({ ...claim, status: value as Claim["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="case_number">Case Number *</Label>
              <Input
                id="case_number"
                value={claim.case_number}
                onChange={(e) => {
                  setClaim({ ...claim, case_number: e.target.value });
                  clearError('case_number');
                }}
                placeholder="e.g., CV-2024-001"
                className={formErrors.case_number ? 'border-red-500 focus:border-red-500' : ''}
                required
              />
              {formErrors.case_number && (
                <p className="text-red-500 text-sm mt-1">{formErrors.case_number}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="court">Court/Tribunal</Label>
              <Input
                id="court"
                value={claim.court || ""}
                onChange={(e) => setClaim({ ...claim, court: e.target.value })}
                placeholder="e.g., Superior Court"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plaintiff">Plaintiff Name</Label>
              <Input
                id="plaintiff"
                value={claim.plaintiff_name || ""}
                onChange={(e) => setClaim({ ...claim, plaintiff_name: e.target.value })}
                placeholder="Plaintiff name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defendant">Defendant Name</Label>
              <Input
                id="defendant"
                value={claim.defendant_name || ""}
                onChange={(e) => setClaim({ ...claim, defendant_name: e.target.value })}
                placeholder="Defendant name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={claim.description || ""}
              onChange={(e) => setClaim({ ...claim, description: e.target.value })}
              className="min-h-[100px]"
              placeholder="Describe the claim details..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create Claim</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
