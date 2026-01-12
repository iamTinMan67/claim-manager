import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Edit, Calendar, User, FileText, Phone, Mail, MessageSquare, Home, Building2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { EvidenceService } from '@/services/evidenceService';

interface CommunicationLog {
  id: string;
  claim_id: string;
  date: string;
  name: string;
  company: string | null;
  notes: string | null;
  type: 'Call' | 'Mail' | 'Text' | 'Email' | 'Visit';
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string | null;
  claimTitle: string | null;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'Call':
      return <Phone className="w-4 h-4" />;
    case 'Email':
      return <Mail className="w-4 h-4" />;
    case 'Text':
      return <MessageSquare className="w-4 h-4" />;
    case 'Mail':
      return <FileText className="w-4 h-4" />;
    case 'Visit':
      return <Home className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

export const CommunicationLog = ({ open, onOpenChange, claimId, claimTitle }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  
  // File upload function
  const uploadFileToStorage = async (file: File): Promise<{ fileUrl: string; fileName: string } | null> => {
    if (!user) return null;

    setUploading(true);
    try {
      const sanitizeFileName = (name: string): string => {
        const trimmed = name.trim().toLowerCase();
        const replaced = trimmed.replace(/[^a-z0-9._-]+/g, '-');
        return replaced.replace(/-+/g, '-');
      };

      const originalExt = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const safeBase = sanitizeFileName(baseName) || 'file';
      const safeName = `${safeBase}-${Date.now()}${originalExt}`;
      const filePath = `${user.id}/${safeName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidence-files')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({
          title: "Upload Error",
          description: "Failed to upload file. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('evidence-files')
        .getPublicUrl(filePath);

      return { fileUrl: publicUrl, fileName: file.name };
    } finally {
      setUploading(false);
    }
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [pages, setPages] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 16), // Format for datetime-local input
    name: '',
    company: '',
    notes: '',
    type: 'Call' as 'Call' | 'Mail' | 'Text' | 'Email' | 'Visit',
  });

  // Fetch communication logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['communication-logs', claimId],
    queryFn: async () => {
      if (!claimId) return [];
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('claim_id', claimId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as CommunicationLog[];
    },
    enabled: !!claimId && open,
  });

  // Add/Update mutation
  const saveLogMutation = useMutation({
    mutationFn: async (logData: Partial<CommunicationLog>) => {
      if (!claimId || !user) throw new Error('Claim ID or user not available');
      
      const dataToSave = {
        ...logData,
        claim_id: claimId,
        user_id: user.id,
        date: new Date(logData.date || formData.date).toISOString(),
      };

      if (editingLog) {
        const { data, error } = await supabase
          .from('communication_logs')
          .update(dataToSave)
          .eq('id', editingLog.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('communication_logs')
          .insert(dataToSave)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['communication-logs', claimId] });
      
      // If file is uploaded, create evidence entry
      if (selectedFile && claimId && user) {
        try {
          // Upload file
          const uploadResult = await uploadFileToStorage(selectedFile);
          if (uploadResult) {
            // Create evidence entry
            const evidenceData = {
              file_name: fileName || selectedFile.name,
              file_url: uploadResult.fileUrl,
              number_of_pages: pages ? parseInt(pages) : null,
              date_submitted: new Date(formData.date).toISOString().split('T')[0],
              method: formData.type,
              exhibit_number: null,
              url_link: null,
              book_of_deeds_ref: null,
            };

            const evidence = await EvidenceService.createEvidence(evidenceData, user.id);
            
            // Link evidence to claim
            if (evidence?.id) {
              await EvidenceService.linkEvidenceToClaim(evidence.id, claimId);
            }

            // Invalidate evidence queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ['evidence'] });
            
            toast({
              title: 'Evidence created',
              description: 'File uploaded and added to evidence.',
            });
          }
        } catch (error: any) {
          console.error('Error creating evidence:', error);
          toast({
            title: 'Warning',
            description: 'Communication log saved, but evidence creation failed: ' + (error.message || 'Unknown error'),
            variant: 'destructive',
          });
        }
      }

      setShowAddForm(false);
      setEditingLog(null);
      setShowFileUpload(false);
      setSelectedFile(null);
      setFileName('');
      setPages('');
      setFormData({
        date: new Date().toISOString().slice(0, 16),
        name: '',
        company: '',
        notes: '',
        type: 'Call',
      });
      toast({
        title: editingLog ? 'Log updated' : 'Log added',
        description: 'Communication log saved successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save communication log.',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('communication_logs')
        .delete()
        .eq('id', logId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-logs', claimId] });
      toast({
        title: 'Log deleted',
        description: 'Communication log deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete communication log.',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (log: CommunicationLog) => {
    setEditingLog(log);
    setFormData({
      date: new Date(log.date).toISOString().slice(0, 16),
      name: log.name,
      company: log.company || '',
      notes: log.notes || '',
      type: log.type,
    });
    setShowAddForm(true);
  };

  const handleDelete = (logId: string) => {
    if (confirm('Are you sure you want to delete this communication log?')) {
      deleteLogMutation.mutate(logId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveLogMutation.mutate(formData);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingLog(null);
    setShowFileUpload(false);
    setSelectedFile(null);
    setFileName('');
    setPages('');
    setFormData({
      date: new Date().toISOString().slice(0, 16),
      name: '',
      company: '',
      notes: '',
      type: 'Call',
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setShowFileUpload(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Communication Log - {claimTitle || 'Claim'}</span>
            {!showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Log
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {showAddForm ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date & Time</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'Call' | 'Mail' | 'Text' | 'Email' | 'Visit') =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Call">Call</SelectItem>
                    <SelectItem value="Mail">Mail</SelectItem>
                    <SelectItem value="Text">Text</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Visit">Visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Staff name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Organization name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this communication..."
                rows={4}
              />
            </div>

            {/* File Upload Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>File Upload</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowFileUpload(!showFileUpload);
                    if (!showFileUpload) {
                      setSelectedFile(null);
                      setFileName('');
                      setPages('');
                    }
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {showFileUpload ? 'Hide' : 'Upload File'}
                </Button>
              </div>

              {showFileUpload && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="file">Select File</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                    {selectedFile && (
                      <p className="text-sm text-gray-600">Selected: {selectedFile.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fileName">File Name</Label>
                      <Input
                        id="fileName"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="File name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pages">Pages</Label>
                      <Input
                        id="pages"
                        type="number"
                        value={pages}
                        onChange={(e) => setPages(e.target.value)}
                        placeholder="Number of pages"
                        min="1"
                      />
                    </div>
                  </div>

                  {uploading && (
                    <div className="text-sm text-blue-600">
                      Uploading file...
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveLogMutation.isPending}>
                {editingLog ? 'Update' : 'Add'} Log
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No communication logs yet. Click "Add Log" to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center space-x-2 text-gray-600">
                            {getTypeIcon(log.type)}
                            <span className="font-semibold">{log.type}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {formatDate(log.date)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{log.name}</span>
                        </div>
                        {log.company && (
                          <div className="flex items-center space-x-2 mb-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">{log.company}</span>
                          </div>
                        )}
                        {log.notes && (
                          <div className="mt-2 text-sm text-gray-700">
                            <FileText className="w-4 h-4 inline mr-1 text-gray-500" />
                            {log.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(log)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(log.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
