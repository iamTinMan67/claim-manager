
import { useState, useEffect } from "react";
import { Evidence } from "@/types/evidence";
import { useExhibits } from "@/hooks/useExhibits";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Eye, Trash2, Unlink, FileText, File, Edit, GripVertical, Save, X, EditIcon, Eye as ViewIcon, RotateCcw, CheckCheck } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { PDFViewer } from "./PDFViewer";
import { EditEvidenceFileModal } from "./EditEvidenceFileModal";
import { EditableExhibitSelector } from "./EditableExhibitSelector";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';

interface Props {
  evidenceList: Evidence[];
  onRemove: (id: string) => void;
  showClaimInfo?: boolean;
  onUnlinkFromClaim?: (evidenceId: string) => void;
  onUpdateEvidence?: (evidenceId: string, updates: Partial<Evidence>) => void;
  onReorderEvidence?: (newOrder: Evidence[]) => void;
  unlinkedMode?: boolean;
  selectedEvidence?: string[];
  onToggleSelection?: (evidenceId: string) => void;
}

interface SortableRowProps {
  evidence: Evidence;
  index: number;
  bundlePageNumber: number;
  onRemove: (id: string) => void;
  showClaimInfo: boolean;
  onUnlinkFromClaim?: (evidenceId: string) => void;
  onUpdateEvidence?: (evidenceId: string, updates: Partial<Evidence>) => void;
  onViewFile: (evidence: Evidence) => void;
  onEditFile: (evidence: Evidence) => void;
  exhibits: any[];
  isEditMode: boolean;
  onFieldChange: (evidenceId: string, field: keyof Evidence, value: any) => void;
  localEvidence: Evidence;
  unlinkedMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (evidenceId: string) => void;
}

// Natural sorting function for exhibit IDs
const naturalSort = (a: string, b: string) => {
  console.log('naturalSort comparing:', a, 'vs', b);
  
  // Extract numbers from exhibit IDs
  const extractNumber = (str: string) => {
    if (!str) return 0;
    const match = str.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 0;
    console.log(`extractNumber from "${str}":`, num);
    return num;
  };

  const numA = extractNumber(a);
  const numB = extractNumber(b);
  
  const result = numB - numA; // Descending order (newest first)
  console.log(`naturalSort result: ${numA} vs ${numB} = ${result}`);
  return result;
};

// Format exhibit ID to get proper exhibit display - just the exhibit number
const formatExhibitDisplay = (exhibitId: string | null, exhibits: any[]) => {
  if (!exhibitId || !exhibits.length) return '';
  
  // First try to find the exhibit by its actual ID (UUID)
  const exhibitById = exhibits.find(e => e.id === exhibitId);
  if (exhibitById) {
    return `Exhibit-${exhibitById.exhibit_number.toString().padStart(3, '0')}`;
  }
  
  // Legacy fallback for EX### format
  if (exhibitId.startsWith('EX')) {
    const number = parseInt(exhibitId.substring(2));
    const legacyExhibit = exhibits.find(e => e.exhibit_number === number);
    if (legacyExhibit) {
      return `Exhibit-${legacyExhibit.exhibit_number.toString().padStart(3, '0')}`;
    }
    return exhibitId; // fallback to original format
  }
  
  return exhibitId;
};

const SortableRow = ({ 
  evidence, 
  index, 
  bundlePageNumber,
  onRemove, 
  showClaimInfo, 
  onUnlinkFromClaim, 
  onUpdateEvidence, 
  onViewFile, 
  onEditFile,
  exhibits,
  isEditMode,
  onFieldChange,
  localEvidence,
  unlinkedMode,
  isSelected,
  onToggleSelection
}: SortableRowProps) => {
  console.log('SortableRow rendering evidence:', evidence.id, 'filename:', evidence.file_name);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: evidence.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const getFileIcon = (fileName: string | null) => {
    if (!fileName) return FileText;
    
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'pdf') {
      return File;
    }
    return FileText;
  };

  // Helper function to convert formatted exhibit display back to UUID
  const convertDisplayToUUID = (displayValue: string) => {
    if (!displayValue || !displayValue.startsWith('Exhibit-')) return null;
    
    const numberPart = displayValue.replace('Exhibit-', '');
    const exhibitNumber = parseInt(numberPart, 10);
    
    const exhibit = exhibits.find(e => e.exhibit_number === exhibitNumber);
    return exhibit ? exhibit.id : null;
  };

  const handleExhibitChange = (displayValue: string) => {
    const exhibitId = convertDisplayToUUID(displayValue);
    onFieldChange(evidence.id, 'exhibit_id', exhibitId);
  };

  const FileIcon = getFileIcon(evidence.file_name);

  // Find the exhibit from the exhibits table
  const getExhibitInfo = () => {
    if (!evidence.exhibit_id) return null;
    
    // First try to find by actual exhibit ID
    const exhibitById = exhibits.find(exhibit => exhibit.id === evidence.exhibit_id);
    if (exhibitById) return exhibitById;
    
    // Fallback: Handle legacy exhibit ID formats for backwards compatibility
    let exhibitNumber: number | null = null;
    
    // Match "EX###" format (e.g., "EX025" -> 25)
    let match = evidence.exhibit_id.match(/^EX(\d+)$/i);
    if (match) {
      exhibitNumber = parseInt(match[1], 10);
    } else {
      // Match "Exhibit #" format (e.g., "Exhibit 1" -> 1)
      match = evidence.exhibit_id.match(/^Exhibit\s+(\d+)$/i);
      if (match) {
        exhibitNumber = parseInt(match[1], 10);
      } else {
        // Match "Exhibit-###" format (e.g., "Exhibit-001" -> 1)
        match = evidence.exhibit_id.match(/^Exhibit-(\d+)$/i);
        if (match) {
          exhibitNumber = parseInt(match[1], 10);
        }
      }
    }
    
    if (exhibitNumber === null) return null;
    return exhibits.find(exhibit => exhibit.exhibit_number === exhibitNumber);
  };

  const exhibitInfo = getExhibitInfo();
  const displayExhibit = exhibitInfo 
    ? `Exhibit-${exhibitInfo.exhibit_number.toString().padStart(3, '0')}`
    : formatExhibitDisplay(evidence.exhibit_id, exhibits) || `Exhibit ${index + 1}`;

  return (
    <tr ref={setNodeRef} style={style} className={`border-b transition-colors hover:bg-muted/50 ${isSelected ? 'bg-muted/30' : ''}`}>
      {/* Selection checkbox for unlinked mode */}
      {unlinkedMode && (
        <td className="px-2 py-4 whitespace-nowrap">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection?.(evidence.id)}
          />
        </td>
      )}
      
      <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        <div className="flex items-center space-x-2">
          {!isEditMode && !unlinkedMode && (
            <div {...attributes} {...listeners} className="cursor-move">
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
          )}
          {isEditMode ? (
            <EditableExhibitSelector
              value={displayExhibit}
              onChange={handleExhibitChange}
            />
          ) : (
            <span title={exhibitInfo?.description || undefined}>{displayExhibit}</span>
          )}
        </div>
      </td>
      <td className="px-2 py-4 text-sm text-gray-900" style={{ width: '25%', minWidth: '200px' }}>
        {isEditMode ? (
          <Input
            value={localEvidence.file_name || ''}
            onChange={(e) => onFieldChange(evidence.id, 'file_name', e.target.value)}
            className="w-full h-8 text-sm"
            placeholder="Filename..."
          />
        ) : (
          <div className="w-full overflow-hidden">
            {evidence.file_name ? (
              <div className="flex items-center space-x-2 w-full">
                <FileIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="truncate flex-1 text-gray-900" title={evidence.file_name}>
                  {evidence.file_name}
                </span>
                {evidence.file_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewFile(evidence)}
                    className="p-1 flex-shrink-0"
                    title="View file"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-gray-400">No file</span>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-4 text-sm text-gray-900" style={{ width: '20%', minWidth: '150px' }}>
        {isEditMode ? (
          <Input
            value={localEvidence.description || ''}
            onChange={(e) => onFieldChange(evidence.id, 'description', e.target.value)}
            className="w-full h-8 text-sm"
            placeholder="Description..."
          />
        ) : (
          <div className="w-full overflow-hidden">
            <span className="truncate block text-gray-900" title={evidence.description || ''}>
              {evidence.description || 'N/A'}
            </span>
          </div>
        )}
      </td>
      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900" style={{ width: '10%' }}>
        {isEditMode ? (
          <Input
            type="number"
            min="1"
            value={localEvidence.number_of_pages || ''}
            onChange={(e) => onFieldChange(evidence.id, 'number_of_pages', e.target.value ? parseInt(e.target.value) : null)}
            className="w-20 h-8 text-sm"
          />
        ) : (
          evidence.number_of_pages || 'N/A'
        )}
      </td>
      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
        {isEditMode ? (
          <Input
            type="date"
            value={formatDateForInput(localEvidence.date_submitted)}
            onChange={(e) => onFieldChange(evidence.id, 'date_submitted', e.target.value || null)}
            className="w-36 h-8 text-sm"
          />
        ) : (
          formatDate(evidence.date_submitted)
        )}
      </td>
      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
        {isEditMode ? (
          <Select 
            value={localEvidence.method || ''} 
            onValueChange={(value) => onFieldChange(evidence.id, 'method', value || null)}
          >
            <SelectTrigger className="w-24 h-8 text-sm">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Post">Post</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Hand">Hand</SelectItem>
              <SelectItem value="Call">Call</SelectItem>
              <SelectItem value="To-Do">To-Do</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          evidence.method || 'N/A'
        )}
      </td>
      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
        {bundlePageNumber}
      </td>
      {showClaimInfo && (
        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
            {evidence.claimIds.length} claim{evidence.claimIds.length !== 1 ? 's' : ''}
          </span>
        </td>
      )}
      {isEditMode && (
        <td className="px-2 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(evidence.id)}
              className="text-red-600 hover:text-red-700"
              title="Delete evidence"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            {onUpdateEvidence && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditFile(evidence)}
                className="text-blue-600 hover:text-blue-700"
                title="Manage file"
              >
                <File className="w-4 h-4" />
              </Button>
            )}
            {onUnlinkFromClaim && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUnlinkFromClaim(evidence.id)}
                className="text-orange-600 hover:text-orange-700"
                title="Unlink from claim"
              >
                <Unlink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
};

export const EvidenceTable = ({ 
  evidenceList, 
  onRemove, 
  showClaimInfo = true,
  onUnlinkFromClaim,
  onUpdateEvidence,
  onReorderEvidence,
  unlinkedMode = false,
  selectedEvidence = [],
  onToggleSelection
}: Props) => {
  const [selectedPDF, setSelectedPDF] = useState<{fileUrl: string, fileName: string} | null>(null);
  const [editingFile, setEditingFile] = useState<Evidence | null>(null);
  const [localEvidenceList, setLocalEvidenceList] = useState(evidenceList);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { exhibits } = useExhibits();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleViewFile = (evidence: Evidence) => {
    if (evidence.file_url && evidence.file_name) {
      // For PDF files, use the PDF viewer
      if (evidence.file_name.toLowerCase().endsWith('.pdf')) {
        setSelectedPDF({
          fileUrl: evidence.file_url,
          fileName: evidence.file_name
        });
      } else {
        // For other file types, open in new tab
        window.open(evidence.file_url, '_blank');
      }
    }
  };

  const handleEditFile = (evidence: Evidence) => {
    setEditingFile(evidence);
  };

  const handleUpdateFile = (evidenceId: string, updates: Partial<Evidence>) => {
    if (onUpdateEvidence) {
      onUpdateEvidence(evidenceId, updates);
    }
    setEditingFile(null);
  };

  const handleFieldChange = (evidenceId: string, field: keyof Evidence, value: any) => {
    setLocalEvidenceList(prev => 
      prev.map(evidence => 
        evidence.id === evidenceId 
          ? { ...evidence, [field]: value }
          : evidence
      )
    );
    setHasChanges(true);
  };

  const handleSaveChanges = () => {
    if (!onUpdateEvidence || !onReorderEvidence) return;

    localEvidenceList.forEach((evidence, index) => {
      const originalEvidence = evidenceList.find(e => e.id === evidence.id);
      if (originalEvidence) {
        // Check if any fields have changed
        const hasFieldChanges = Object.keys(evidence).some(key => {
          const field = key as keyof Evidence;
          return evidence[field] !== originalEvidence[field];
        });

        if (hasFieldChanges) {
          onUpdateEvidence(evidence.id, evidence);
        }
      }
    });

    // Update the display order based on current order
    onReorderEvidence(localEvidenceList);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalEvidenceList(evidenceList);
    setHasChanges(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isEditMode) return; // Disable drag in edit mode
    
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localEvidenceList.findIndex((item) => item.id === active.id);
      const newIndex = localEvidenceList.findIndex((item) => item.id === over.id);
      
      const newOrder = arrayMove(localEvidenceList, oldIndex, newIndex);
      setLocalEvidenceList(newOrder);
      
      if (onReorderEvidence) {
        onReorderEvidence(newOrder);
      }
    }
  };

  // Use display_order from database, fallback to creation order
  useEffect(() => {
    console.log('EvidenceTable: evidenceList changed, length:', evidenceList.length);
    console.log('EvidenceTable: raw evidenceList:', evidenceList.map(e => ({ id: e.id, exhibit_id: e.exhibit_id, display_order: e.display_order, file_name: e.file_name })));
    
    // Sort evidence by display_order first, then by created_at if no display_order (descending order - highest exhibit numbers first)
    const sortedEvidence = [...evidenceList].sort((a, b) => {
      // If both have display_order, use that (descending - higher numbers first)
      if (a.display_order !== null && b.display_order !== null) {
        return b.display_order - a.display_order;
      }
      // If only one has display_order, prioritize it
      if (a.display_order !== null) return -1;
      if (b.display_order !== null) return 1;
      // If neither has display_order, use creation date (descending - newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    console.log('EvidenceTable: sorted evidence:', sortedEvidence.map(e => ({ id: e.id, exhibit_id: e.exhibit_id, display_order: e.display_order, file_name: e.file_name })));
    setLocalEvidenceList(sortedEvidence);
  }, [evidenceList]);

  if (localEvidenceList.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No evidence items found.</p>
      </div>
    );
  }

  console.log('EvidenceTable rendering with localEvidenceList:', localEvidenceList.length, 'items');

  return (
    <>
      <div className="mb-4 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Evidence Items</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={isEditMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
              className="flex items-center space-x-2"
            >
              {isEditMode ? <ViewIcon className="w-4 h-4" /> : <EditIcon className="w-4 h-4" />}
              <span>{isEditMode ? 'View Mode' : 'Edit Mode'}</span>
            </Button>
          </div>
        </div>
        
        {isEditMode && (
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges}
              className="flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveChanges}
              disabled={!hasChanges}
              className="flex items-center space-x-2"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Save Changes</span>
            </Button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50">
              <tr>
                {unlinkedMode && (
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '5%' }}>
                    <Checkbox
                      checked={selectedEvidence.length === evidenceList.length && evidenceList.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked && onToggleSelection) {
                          evidenceList.forEach(e => onToggleSelection(e.id));
                        } else if (!checked && onToggleSelection) {
                          selectedEvidence.forEach(id => onToggleSelection(id));
                        }
                      }}
                    />
                  </th>
                )}
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: unlinkedMode ? '11%' : '12%' }}>
                  Exhibit
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '25%' }}>
                  File
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '20%' }}>
                  Description
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '8%' }}>
                  Pages
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '12%' }}>
                  Date
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                  Method
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '8%' }}>
                  Bundle #
                </th>
                {showClaimInfo && (
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '8%' }}>
                    Claims
                  </th>
                )}
                {isEditMode && (
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: showClaimInfo ? '5%' : '10%' }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <SortableContext
                items={localEvidenceList.map(evidence => evidence.id)}
                strategy={verticalListSortingStrategy}
              >
                {localEvidenceList.map((evidence, index) => {
                  console.log(`Rendering row ${index} for evidence:`, evidence.id, evidence.file_name);
                  
                  // Calculate bundle page number - start from page 1 and add up preceding pages
                  let bundlePageNumber = 1;
                  for (let i = 0; i < index; i++) {
                    const pages = localEvidenceList[i].number_of_pages || 1;
                    bundlePageNumber += pages;
                  }
                  
                  return (
                    <SortableRow
                      key={evidence.id}
                      evidence={evidence}
                      index={index}
                      bundlePageNumber={bundlePageNumber}
                      onRemove={onRemove}
                      showClaimInfo={showClaimInfo}
                      onUnlinkFromClaim={onUnlinkFromClaim}
                      onUpdateEvidence={onUpdateEvidence}
                      onViewFile={handleViewFile}
                      onEditFile={handleEditFile}
                      exhibits={exhibits}
                      isEditMode={isEditMode}
                      onFieldChange={handleFieldChange}
                      localEvidence={localEvidenceList.find(e => e.id === evidence.id) || evidence}
                      unlinkedMode={unlinkedMode}
                      isSelected={selectedEvidence.includes(evidence.id)}
                      onToggleSelection={onToggleSelection}
                    />
                  );
                })}
              </SortableContext>
            </tbody>
          </table>
        </div>
      </DndContext>

      {selectedPDF && (
        <PDFViewer
          isOpen={true}
          onClose={() => setSelectedPDF(null)}
          fileUrl={selectedPDF.fileUrl}
          fileName={selectedPDF.fileName}
        />
      )}

      {editingFile && onUpdateEvidence && (
        <EditEvidenceFileModal
          evidence={editingFile}
          onClose={() => setEditingFile(null)}
          onUpdate={handleUpdateFile}
        />
      )}
    </>
  );
};
