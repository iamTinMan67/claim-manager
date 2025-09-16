import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useExhibits, Exhibit } from "@/hooks/useExhibits";
import { Trash2, Plus, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const ExhibitManagement = () => {
  const { exhibits, loading, addExhibit, getNextExhibitNumber } = useExhibits();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleAddExhibit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Exhibit name is required",
        variant: "destructive",
      });
      return;
    }

    const exhibitData = {
      name: formData.name.trim(),
      exhibit_number: getNextExhibitNumber(),
      description: formData.description.trim() || null,
    };

    const result = await addExhibit(exhibitData);
    if (result) {
      setFormData({ name: "", description: "" });
      setShowAddModal(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="text-center py-8">Loading exhibits...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Exhibit Management</h3>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Exhibit
        </Button>
      </div>

      {exhibits.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No exhibits found. Add your first exhibit to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exhibit #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exhibits.map((exhibit) => (
                <TableRow key={exhibit.id}>
                  <TableCell className="font-medium">
                    Exhibit-{exhibit.exhibit_number.toString().padStart(3, '0')}
                  </TableCell>
                  <TableCell>{exhibit.name}</TableCell>
                  <TableCell>{exhibit.description || "—"}</TableCell>
                  <TableCell>{formatDate(exhibit.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit exhibit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        title="Delete exhibit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Exhibit Modal */}
      {showAddModal && (
        <Dialog open onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Exhibit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddExhibit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Exhibit Number
                </label>
                <Input
                  value={`Exhibit-${getNextExhibitNumber().toString().padStart(3, '0')}`}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Exhibit Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter exhibit name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter exhibit description (optional)"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: "", description: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Add Exhibit
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};