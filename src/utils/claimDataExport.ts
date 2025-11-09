import { Claim } from '@/hooks/useClaims';
import { Evidence } from '@/hooks/useEvidence';
import { TodoItem } from '@/types/todo';
import { supabase } from '@/integrations/supabase/client';

export interface ClaimDataExport {
  claim: Claim;
  evidence: Evidence[];
  todos: TodoItem[];
  calendarEntries: any[]; // Google Calendar entries if available
}

export const exportClaimDataToCSV = async (claimId: string, claimTitle: string): Promise<void> => {
  try {
    // Fetch all related data
    const claimData = await gatherClaimData(claimId);
    
    // Create CSV content
    const csvContent = generateClaimDataCSV(claimData);
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `claim_${claimTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting claim data:', error);
    throw error;
  }
};

export const gatherClaimData = async (claimId: string): Promise<ClaimDataExport> => {
  // Fetch claim
  const { data: claimData, error: claimError } = await supabase
    .from('claims')
    .select('*')
    .eq('case_number', claimId)
    .single();

  if (claimError) throw claimError;

  const claim: Claim = {
    ...claimData,
    status: claimData.status as 'Active' | 'Pending' | 'Closed'
  };

  // Fetch evidence linked to this claim
  const { data: evidenceLinks, error: linksError } = await supabase
    .from('evidence_claims')
    .select('evidence_id')
    .eq('claim_id', claimId);

  if (linksError) throw linksError;

  const evidenceIds = evidenceLinks.map(link => link.evidence_id);
  
  let evidence: Evidence[] = [];
  if (evidenceIds.length > 0) {
    const { data: evidenceData, error: evidenceError } = await supabase
      .from('evidence')
      .select('*')
      .in('id', evidenceIds);

    if (evidenceError) throw evidenceError;
    
    // Transform to Evidence type with claimIds
    evidence = (evidenceData || []).map(item => ({
      ...item,
      claimIds: [claimId] // Since we're fetching for a specific claim
    }));
  }

  // Fetch todos linked to evidence for this claim
  let todos: TodoItem[] = [];
  if (evidenceIds.length > 0) {
    const { data: todoData, error: todoError } = await supabase
      .from('todos')
      .select('*')
      .in('evidence_id', evidenceIds);

    if (todoError) throw todoError;
    
    todos = (todoData || []).map(todo => ({
      id: todo.id,
      userId: todo.user_id,
      title: todo.title,
      description: todo.description || '',
      completed: todo.completed,
      completedAt: todo.completed_at ? new Date(todo.completed_at) : undefined,
      dueDate: new Date(todo.due_date),
      priority: todo.priority as 'low' | 'medium' | 'high',
      evidenceId: todo.evidence_id,
      alarmEnabled: todo.alarm_enabled,
      alarmTime: todo.alarm_time ? new Date(todo.alarm_time) : undefined,
    }));
  }

  return {
    claim,
    evidence,
    todos,
    calendarEntries: [], // Could be enhanced to fetch Google Calendar entries if needed
  };
};

const generateClaimDataCSV = (data: ClaimDataExport): string => {
  const lines: string[] = [];
  
  // Header
  lines.push('Claim Data Export');
  lines.push('Generated on: ' + new Date().toLocaleString());
  lines.push('');
  
  // Claim Information
  lines.push('CLAIM INFORMATION');
  lines.push('Field,Value');
  lines.push(`Title,"${escapeCSV(data.claim.title)}"`);
  lines.push(`Case Number,"${escapeCSV(data.claim.case_number)}"`);
  lines.push(`Status,"${escapeCSV(data.claim.status)}"`);
  lines.push(`Court,"${escapeCSV(data.claim.court || '')}"`);
  lines.push(`Plaintiff,"${escapeCSV(data.claim.plaintiff_name || '')}"`);
  lines.push(`Defendant,"${escapeCSV(data.claim.defendant_name || '')}"`);
  lines.push(`Description,"${escapeCSV(data.claim.description || '')}"`);
  lines.push(`Created Date,"${escapeCSV(new Date(data.claim.created_at).toLocaleString())}"`);
  lines.push(`Updated Date,"${escapeCSV(new Date(data.claim.updated_at).toLocaleString())}"`);
  lines.push('');
  
  // Evidence Items
  lines.push('EVIDENCE ITEMS');
  lines.push('Exhibit ID,File Name,Pages,Method,Date Submitted,URL Link,Book of Deeds Ref,Created Date');
  
  data.evidence.forEach(evidence => {
    lines.push([
      escapeCSV((evidence as any).exhibit_number?.toString() || ''),
      escapeCSV(evidence.file_name || ''),
      escapeCSV(evidence.number_of_pages?.toString() || ''),
      escapeCSV(evidence.method || ''),
      escapeCSV(evidence.date_submitted || ''),
      escapeCSV(evidence.url_link || ''),
      escapeCSV(evidence.book_of_deeds_ref || ''),
      escapeCSV(new Date(evidence.created_at).toLocaleString()),
    ].join(','));
  });
  
  lines.push('');
  
  // Todo Items
  lines.push('TODO ITEMS');
  lines.push('Title,Description,Due Date,Priority,Completed,Completed Date,Alarm Enabled,Alarm Time,Evidence ID');
  
  data.todos.forEach(todo => {
    lines.push([
      escapeCSV(todo.title),
      escapeCSV(todo.description),
      escapeCSV(todo.dueDate.toLocaleString()),
      escapeCSV(todo.priority),
      escapeCSV(todo.completed ? 'Yes' : 'No'),
      escapeCSV(todo.completedAt?.toLocaleString() || ''),
      escapeCSV(todo.alarmEnabled ? 'Yes' : 'No'),
      escapeCSV(todo.alarmTime?.toLocaleString() || ''),
      escapeCSV(todo.evidenceId || ''),
    ].join(','));
  });
  
  return lines.join('\n');
};

const escapeCSV = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};