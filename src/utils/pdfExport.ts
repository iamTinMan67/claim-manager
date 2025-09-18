import jsPDF from 'jspdf';
import { Claim } from '@/hooks/useClaims';
import { Evidence } from '@/hooks/useEvidence';
import { 
  PDFFieldConfig, 
  DEFAULT_CLAIM_FIELDS, 
  DEFAULT_EVIDENCE_FIELDS,
  CLAIM_FIELD_LABELS,
  EVIDENCE_FIELD_LABELS 
} from '@/types/pdfConfig';

// Define column width percentages for different field types
const FIELD_WIDTH_MAPPING = {
  exhibitId: 0.11,    // 10% - for exhibit numbers
  fileName: 0.29,     // 42% - for file names (with PDF icon)
  pages: 0.08,        // 12% - for page numbers
  method: 0.11,       // 13% - for method
  date: 0.17,         // 17% - for dates
  bundlePage: 0.06,   // 6% - for bundle pos (moved closer)
};

// Calculate character limits based on column width
const getCharacterLimit = (widthPercentage: number, totalWidth: number) => {
  const columnWidth = totalWidth * widthPercentage;
  return Math.floor(columnWidth * 0.35); // Approximate characters per column
};

export const generateClaimEvidencePDF = (
  claim: Claim,
  evidenceList: Evidence[],
  config?: PDFFieldConfig
) => {
  const fieldConfig = config || {
    claimFields: DEFAULT_CLAIM_FIELDS,
    evidenceFields: DEFAULT_EVIDENCE_FIELDS,
  };

  const pdf = new jsPDF();
  let yPosition = 20;
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const tableWidth = pageWidth - 2 * margin;

  // Helper function to add new page if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to wrap text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return lines.length * (fontSize * 0.5); // Approximate line height
  };

  // Helper function to wrap text for specific fields
  const wrapTextForField = (text: string, fieldKey: string, maxWidth: number) => {
    if (!text) return [];
    if (fieldKey === 'exhibitId' || fieldKey === 'fileName') {
      return pdf.splitTextToSize(text, maxWidth);
    }
    // For other fields, use truncation as before
    const widthPercentage = FIELD_WIDTH_MAPPING[fieldKey as keyof typeof FIELD_WIDTH_MAPPING] || 0.15;
    const charLimit = getCharacterLimit(widthPercentage, tableWidth);
    const truncatedText = text.length > charLimit ? text.substring(0, charLimit - 3) + '...' : text;
    return [truncatedText];
  };

  // Helper function to draw table headers with variable widths
  const drawTableHeaders = (y: number) => {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    const selectedFields = Object.entries(fieldConfig.evidenceFields)
      .filter(([_, selected]) => selected)
      .map(([key, _]) => key);
    
    let currentX = margin;
    
    selectedFields.forEach((fieldKey) => {
      const label = EVIDENCE_FIELD_LABELS[fieldKey as keyof typeof EVIDENCE_FIELD_LABELS];
      const widthPercentage = FIELD_WIDTH_MAPPING[fieldKey as keyof typeof FIELD_WIDTH_MAPPING] || 0.15;
      const columnWidth = tableWidth * widthPercentage;
      
      pdf.text(label, currentX, y);
      currentX += columnWidth;
    });
    
    // Draw header underline
    pdf.setLineWidth(0.5);
    pdf.line(margin, y + 2, pageWidth - margin, y + 2);
    
    return y + 8; // Return new Y position after headers
  };

  // Helper function to draw table row with variable widths and text wrapping
  const drawTableRow = (evidence: Evidence, y: number, bundlePageNumber: number, index: number) => {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    const selectedFields = Object.entries(fieldConfig.evidenceFields)
      .filter(([_, selected]) => selected)
      .map(([key, _]) => key);
    
    let currentX = margin;
    let maxRowHeight = 10; // Minimum row height
    
    // First pass: calculate all text lines and determine max row height
    const fieldData: Array<{
      fieldKey: string;
      x: number;
      width: number;
      lines: string[];
      shouldCenter: boolean;
    }> = [];
    
    selectedFields.forEach((fieldKey) => {
      const widthPercentage = FIELD_WIDTH_MAPPING[fieldKey as keyof typeof FIELD_WIDTH_MAPPING] || 0.15;
      const columnWidth = tableWidth * widthPercentage;
      
      let value = '';
      
      switch (fieldKey) {
        case 'exhibitId':
          value = `Exhibit ${index + 1}`;
          break;
        case 'fileName':
          // Remove .pdf extension and add PDF icon indicator
          value = evidence.file_name ? evidence.file_name.replace(/\.pdf$/i, '') : '';
          break;
        case 'pages':
          value = evidence.number_of_pages ? evidence.number_of_pages.toString() : '';
          break;
        case 'date':
          value = evidence.date_submitted ? new Date(evidence.date_submitted).toLocaleDateString() : '';
          break;
        case 'method':
          value = evidence.method || '';
          break;
        case 'bundlePage':
          value = bundlePageNumber.toString();
          break;
      }
      
      const lines = wrapTextForField(value, fieldKey, columnWidth - 2); // Small margin
      const shouldCenter = fieldKey === 'pages' || fieldKey === 'method' || fieldKey === 'bundlePage';
      
      fieldData.push({
        fieldKey,
        x: currentX,
        width: columnWidth,
        lines,
        shouldCenter
      });
      
      // Update max row height based on number of lines
      const fieldHeight = lines.length * 10; // 10 points per line
      maxRowHeight = Math.max(maxRowHeight, fieldHeight);
      
      currentX += columnWidth;
    });
    
    // Second pass: draw all text
    fieldData.forEach(({ x, width, lines, shouldCenter }) => {
      lines.forEach((line, lineIndex) => {
        const lineY = y + (lineIndex * 10);
        
        if (shouldCenter) {
          const textWidth = pdf.getTextWidth(line);
          const centerX = x + (width - textWidth) / 2;
          pdf.text(line, centerX, lineY);
        } else {
          pdf.text(line, x, lineY);
        }
      });
    });
    
    return y + maxRowHeight; // Return new Y position for next row
  };

  // Sort evidence by exhibit ID in ascending order
  const sortedEvidence = [...evidenceList].sort((a, b) => {
    if (!a.exhibit_id || !b.exhibit_id) return 0;
    
    // Extract numeric part from exhibit IDs
    const getExhibitNumber = (exhibitId: string) => {
      const match = exhibitId.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    return getExhibitNumber(a.exhibit_id) - getExhibitNumber(b.exhibit_id);
  });

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Claim Evidence Report', margin, yPosition);
  yPosition += 15;

  // Claim Information - only show selected fields
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Claim Information', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const claimInfoMapping = {
    caseNumber: `Case Number: ${claim.case_number}`,
    court: `Court: ${claim.court || 'N/A'}`,
    plaintiff: `Plaintiff: ${claim.plaintiff_name || 'N/A'}`,
    defendant: `Defendant: ${claim.defendant_name || 'N/A'}`,
    status: `Status: ${claim.status}`
  };

  Object.entries(fieldConfig.claimFields).forEach(([fieldKey, selected]) => {
    if (selected) {
      const info = claimInfoMapping[fieldKey as keyof typeof claimInfoMapping];
      if (info) {
        checkPageBreak(8);
        const textHeight = addWrappedText(info, margin, yPosition, pageWidth - 2 * margin, 10);
        yPosition += Math.max(textHeight, 8);
      }
    }
  });

  yPosition += 15;

  // Evidence Section
  checkPageBreak(30);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Evidence Items', margin, yPosition);
  yPosition += 15;

  if (sortedEvidence.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('No evidence items found.', margin, yPosition);
  } else {
    // Draw initial table headers
    yPosition = drawTableHeaders(yPosition);
    
    // Calculate cumulative bundle page numbers
    let cumulativePages = 1; // Start at page 1
    
    // Draw evidence rows with cumulative bundle page numbers
    sortedEvidence.forEach((evidence, index) => {
      // Check if we need a new page (including space for headers)
      if (checkPageBreak(20)) {
        yPosition = drawTableHeaders(yPosition);
      }
      
      // Current exhibit starts at the cumulative page number
      const bundlePageNumber = cumulativePages;
      yPosition = drawTableRow(evidence, yPosition, bundlePageNumber, index);
      
      // Add this exhibit's page count to the cumulative total for the next exhibit
      const pages = evidence.number_of_pages || 1;
      cumulativePages += pages;
    });
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 10
    );
  }

  return pdf;
};

export const generateToDoListPDF = (
  allEvidence: Evidence[],
  allClaims: Claim[]
) => {
  // Filter evidence items with method = "To-Do"
  const todoEvidence = allEvidence.filter(evidence => evidence.method === 'To-Do');
  
  const pdf = new jsPDF();
  let yPosition = 20;
  const margin = 20;
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // Helper function to add new page if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Helper function to wrap text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return lines.length * (fontSize * 0.5);
  };

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('To-Do List', margin, yPosition);
  yPosition += 20;

  // Summary
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total To-Do Items: ${todoEvidence.length}`, margin, yPosition);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition + 10);
  yPosition += 30;

  if (todoEvidence.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('No To-Do items found.', margin, yPosition);
  } else {
    // Group by claim
    const todosByCase = new Map<string, { claim: Claim; todos: Evidence[] }>();
    
    todoEvidence.forEach(evidence => {
      evidence.claimIds.forEach(claimId => {
        const claim = allClaims.find(c => c.case_number === claimId);
        if (claim) {
          const key = claim.case_number;
          if (!todosByCase.has(key)) {
            todosByCase.set(key, { claim, todos: [] });
          }
          todosByCase.get(key)!.todos.push(evidence);
        }
      });
    });

    // Render each case and its to-dos
    for (const [caseNumber, { claim, todos }] of todosByCase) {
      checkPageBreak(40);
      
      // Case header
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Case: ${caseNumber}`, margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${claim.plaintiff_name || 'N/A'} vs ${claim.defendant_name || 'N/A'}`, margin, yPosition);
      yPosition += 15;

      // To-do items for this case
      todos.forEach((todo, index) => {
        checkPageBreak(25);
        
        // Checkbox
        pdf.setLineWidth(0.5);
        pdf.rect(margin, yPosition - 8, 8, 8);
        
        // Item number and description
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const todoText = `${index + 1}. ${todo.file_name || 'Evidence Item'}`;
        const textHeight = addWrappedText(todoText, margin + 15, yPosition - 3, pageWidth - margin - 25, 10);
        
        // Due date if available
        if (todo.date_submitted) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Due: ${new Date(todo.date_submitted).toLocaleDateString()}`, margin + 15, yPosition + textHeight + 5);
          yPosition += textHeight + 15;
        } else {
          yPosition += Math.max(textHeight, 12) + 5;
        }
      });
      
      yPosition += 10; // Space between cases
    }

    // Unassigned to-dos
    const unassignedTodos = todoEvidence.filter(evidence => evidence.claimIds.length === 0);
    if (unassignedTodos.length > 0) {
      checkPageBreak(30);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Unassigned To-Do Items', margin, yPosition);
      yPosition += 15;

      unassignedTodos.forEach((todo, index) => {
        checkPageBreak(25);
        
        // Checkbox
        pdf.setLineWidth(0.5);
        pdf.rect(margin, yPosition - 8, 8, 8);
        
        // Item description
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const todoText = `${index + 1}. ${todo.file_name || 'Evidence Item'}`;
        const textHeight = addWrappedText(todoText, margin + 15, yPosition - 3, pageWidth - margin - 25, 10);
        
        // Due date if available
        if (todo.date_submitted) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Due: ${new Date(todo.date_submitted).toLocaleDateString()}`, margin + 15, yPosition + textHeight + 5);
          yPosition += textHeight + 15;
        } else {
          yPosition += Math.max(textHeight, 12) + 5;
        }
      });
    }
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 10
    );
  }

  return pdf;
};

export const generateEvidenceSummaryPDF = (
  allClaims: Claim[],
  allEvidence: Evidence[]
) => {
  const pdf = new jsPDF();
  let yPosition = 20;
  const margin = 20;
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;

  // Helper function to add new page if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Evidence Summary Report', margin, yPosition);
  yPosition += 20;

  // Summary statistics
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary Statistics', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const stats = [
    `Total Claims: ${allClaims.length}`,
    `Total Evidence Items: ${allEvidence.length}`,
    `Evidence with Files: ${allEvidence.filter(e => e.file_name).length}`,
    `Generated: ${new Date().toLocaleString()}`
  ];

  stats.forEach(stat => {
    pdf.text(stat, margin, yPosition);
    yPosition += 8;
  });

  yPosition += 15;

  // Claims breakdown
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Claims Breakdown', margin, yPosition);
  yPosition += 10;

  allClaims.forEach((claim, index) => {
    checkPageBreak(25);
    
    const claimEvidence = allEvidence.filter(e => e.claimIds.includes(claim.case_number));
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${index + 1}. ${claim.title}`, margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Case: ${claim.case_number} | Evidence Items: ${claimEvidence.length}`, margin + 10, yPosition);
    yPosition += 12;
  });

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 10
    );
  }

  return pdf;
};
