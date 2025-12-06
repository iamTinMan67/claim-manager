# PDF Column Modification Guide

This guide explains how to adjust PDF column layouts in the Claim Manager application.

## Overview
The application uses jsPDF library to generate PDF reports. Column positions are controlled by x-coordinates in the code.

## Key Files
- `src/components/ExportFeatures.tsx` - Main export functionality
- `src/utils/pdfExport.ts` - Structured PDF generators (evidence report, to-do list, summary)

## Column Positions (Current Layout)
```
Exhibit #:     x=20   (centered)
File Name:     x=50   (left-aligned, width=48)
Method:        x=100  (centered)
Date:          x=130  (centered)
Pages:         x=155  (centered)
Bundle Pos:    x=175  (centered)
CLC Ref#:      x=195  (centered)
```

## Page Metrics
- **Page Width**: `pdf.internal.pageSize.width` (typically 210mm for A4)
- **Page Height**: `pdf.internal.pageSize.height` (typically 297mm for A4)
- **Left Margin**: 20 units (recommended)
- **Right Margin**: 20 units (recommended)

## How to Modify Columns

### 1. Change Column Positions
Edit the x-coordinates in `pdf.text()` calls:
```javascript
// Example: Move Method column 20 units to the right
pdf.text('METHOD', 120, yPosition, { align: 'center' })  // was 100
```

### 2. Adjust Column Widths
For text wrapping, modify the `maxWidth` parameter:
```javascript
// Example: Make file name column wider
const lines = pdf.splitTextToSize(text, 60)  // was 48
```

### 3. Add/Remove Columns
- **Add**: Insert new `pdf.text()` calls with appropriate x-coordinates
- **Remove**: Delete corresponding `pdf.text()` calls from both headers and data rows

### 4. Change Alignment
Add alignment parameter to `pdf.text()`:
```javascript
pdf.text('COLUMN NAME', x, y, { align: 'center' })  // center
pdf.text('COLUMN NAME', x, y, { align: 'right' })   // right
// No align parameter = left-aligned
```

## Consistency Requirements
**IMPORTANT**: Update column positions in ALL locations:
1. Header rows (multiple places in ExportFeatures.tsx)
2. Data rows
3. Page break headers (when content spans multiple pages)

## Recommended Approach: Centralized Column Config
Create a column configuration object to avoid inconsistencies:

```javascript
const COLUMNS = {
  exhibit: { x: 20, align: 'center', width: 15 },
  file:    { x: 40, align: 'left', width: 60 },
  method:  { x: 105, align: 'center', width: 20 },
  date:    { x: 130, align: 'center', width: 25 },
  pages:   { x: 160, align: 'center', width: 15 },
  bundle:  { x: 180, align: 'center', width: 15 },
  clc:     { x: 200, align: 'center', width: 15 }
}

// Use in code:
pdf.text('EXHIBIT #', COLUMNS.exhibit.x, y, { align: COLUMNS.exhibit.align })
const lines = pdf.splitTextToSize(text, COLUMNS.file.width)
```

## Common Modifications

### Widen File Name Column
1. Move adjacent columns right by 10-20 units each
2. Increase `splitTextToSize` width parameter
3. Update all header and data row positions

### Compact Layout (Fewer Columns)
1. Remove METHOD and DATE columns
2. Shift remaining columns left by 30-40 units each
3. Delete corresponding `pdf.text()` calls

### Two-Line Headers
```javascript
// Draw main header
pdf.text('COLUMN NAME', x, y)
// Draw underline
pdf.line(x-5, y+2, x+20, y+2)
// Start data rows at y+10
```

## Text Wrapping Guidelines
- Use `pdf.splitTextToSize(text, maxWidth)` for long content
- Apply to: file names, descriptions, any variable-length text
- Set `maxWidth` based on available column space

## Testing Changes
1. Export a PDF with sample data
2. Check column alignment across all pages
3. Verify text wrapping works correctly
4. Ensure headers repeat properly on new pages

## File Locations to Update
- `src/components/ExportFeatures.tsx` (lines ~155-240)
- `src/utils/pdfExport.ts` (multiple functions)
- Search for "pdf.text" to find all column references

## Tips
- Keep x-coordinates in ascending order
- Leave 5-10 units between columns for readability
- Test with long file names to ensure wrapping works
- Use consistent font sizes (10pt for data, 12pt for headers)
- Consider page margins when positioning rightmost columns
