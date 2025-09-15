import { useState } from "react";
import { useExhibits } from "@/hooks/useExhibits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Edit2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const EditableExhibitSelector = ({ value, onChange, disabled }: Props) => {
  const { exhibits, loading, addExhibit, updateExhibit, getNextExhibitNumber } = useExhibits();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingExhibit, setEditingExhibit] = useState<any>(null);
  const [newExhibitName, setNewExhibitName] = useState("");
  const [newExhibitDescription, setNewExhibitDescription] = useState("");

  // Find the currently selected exhibit
  const selectedExhibit = exhibits.find(e => {
    if (value.startsWith('Exhibit-')) {
      const numberPart = value.replace('Exhibit-', '');
      const exhibitNumber = parseInt(numberPart, 10);
      return e.exhibit_number === exhibitNumber;
    }
    return false;
  });

  const handleCreateNew = async () => {
    if (!newExhibitName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an exhibit name",
        variant: "destructive",
      });
      return;
    }

    const nextNumber = getNextExhibitNumber();
    const result = await addExhibit({
      name: newExhibitName.trim(),
      description: newExhibitDescription.trim() || null,
      exhibit_number: nextNumber,
    });

    if (result) {
      const displayValue = `Exhibit-${result.exhibit_number.toString().padStart(3, '0')}`;
      onChange(displayValue);
      setNewExhibitName("");
      setNewExhibitDescription("");
      setIsCreating(false);
    }
  };

  const handleEditExhibit = async () => {
    if (!editingExhibit || !editingExhibit.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an exhibit name",
        variant: "destructive",
      });
      return;
    }

    const result = await updateExhibit(editingExhibit.id, {
      name: editingExhibit.name.trim(),
      description: editingExhibit.description?.trim() || null,
    });

    if (result) {
      setIsEditing(false);
      setEditingExhibit(null);
    }
  };

  const startEditingExhibit = (exhibit: any) => {
    setEditingExhibit({
      ...exhibit,
      name: exhibit.name,
      description: exhibit.description || "",
    });
    setIsEditing(true);
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full h-6 text-xs">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full h-6 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {exhibits.length === 0 ? (
            <SelectItem value="" disabled>
              No exhibits available
            </SelectItem>
          ) : (
            exhibits
              .sort((a, b) => a.exhibit_number - b.exhibit_number) // Ascending order
              .map((exhibit) => (
                <SelectItem 
                  key={exhibit.id} 
                  value={`Exhibit-${exhibit.exhibit_number.toString().padStart(3, '0')}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Exhibit-{exhibit.exhibit_number.toString().padStart(3, '0')}</span>
                    <span className="text-xs text-muted-foreground ml-2 truncate max-w-24" title={exhibit.name}>
                      {exhibit.name}
                    </span>
                  </div>
                </SelectItem>
              ))
          )}
        </SelectContent>
      </Select>

      {/* Create new exhibit button */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-8 w-8"
            title="Create new exhibit"
            disabled={disabled}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Exhibit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Exhibit Name *</label>
              <Input
                value={newExhibitName}
                onChange={(e) => setNewExhibitName(e.target.value)}
                placeholder="Enter exhibit name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newExhibitDescription}
                onChange={(e) => setNewExhibitDescription(e.target.value)}
                placeholder="Enter exhibit description (optional)"
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNew}>
                Create Exhibit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit current exhibit button */}
      {selectedExhibit && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-8 w-8"
              title="Edit exhibit details"
              onClick={() => startEditingExhibit(selectedExhibit)}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Exhibit Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Exhibit Number</label>
                <Input
                  value={`Exhibit-${selectedExhibit.exhibit_number.toString().padStart(3, '0')}`}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={editingExhibit?.name || ""}
                  onChange={(e) => setEditingExhibit(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Enter exhibit name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingExhibit?.description || ""}
                  onChange={(e) => setEditingExhibit(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Enter exhibit description (optional)"
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditExhibit}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create new exhibit button */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-8 w-8"
            title="Create new exhibit"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Exhibit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Exhibit Number</label>
              <Input
                value={`Exhibit-${getNextExhibitNumber().toString().padStart(3, '0')}`}
                disabled
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={newExhibitName}
                onChange={(e) => setNewExhibitName(e.target.value)}
                placeholder="Enter exhibit name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newExhibitDescription}
                onChange={(e) => setNewExhibitDescription(e.target.value)}
                placeholder="Enter exhibit description (optional)"
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNew}>
                Create Exhibit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};