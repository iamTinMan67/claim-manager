import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Download, FileText, Calendar, Users, CheckSquare, Home, ChevronLeft } from 'lucide-react'
import { useNavigation } from '@/contexts/NavigationContext'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import { getClaimIdFromCaseNumber } from '@/utils/claimUtils'

interface ExportFeaturesProps {
  selectedClaim: string | null
  claimColor?: string
  isGuest?: boolean
  showGuestContent?: boolean
  isGuestFrozen?: boolean
}

const ExportFeatures = ({ selectedClaim, claimColor = '#3B82F6' }: ExportFeaturesProps) => {
  const { navigateBack, navigateTo } = useNavigation()
  const [exportType, setExportType] = useState<'evidence' | 'todos' | 'calendar'>('evidence')
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  const { data: evidence } = useQuery({
    queryKey: ['evidence-export', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('evidence')
        .select(`
          *,
          date_submitted::text
        `)
      
      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }
      
      const { data, error } = await query
        .order('display_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: true })
      
      if (error) throw error
      
      // Clean up empty string dates
      return data?.map(item => ({
        ...item,
        date_submitted: item.date_submitted === '' ? null : item.date_submitted
      })) || []
    }
  })

  const { data: todos } = useQuery({
    queryKey: ['todos-export', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('todos')
        .select('*')
      
      if (selectedClaim) {
        query = query.eq('case_number', selectedClaim)
      }
      
      const { data, error } = await query
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return data
    }
  })

  const { data: events } = useQuery({
    queryKey: ['events-export', selectedClaim],
    queryFn: async () => {
      let query = supabase
        .from('calendar_events')
        .select('*')
      
      if (selectedClaim) {
        const claimId = await getClaimIdFromCaseNumber(selectedClaim)
        if (claimId) {
          query = query.eq('claim_id', claimId)
        }
      }
      
      const { data, error } = await query
        .order('start_time', { ascending: true })
      
      if (error) throw error
      return data
    }
  })

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header.toLowerCase().replace(' ', '_')] || ''
          return `"${String(value).replace(/"/g, '""')}"`
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToPDF = async (data: any[], title: string, filename: string) => {
    setIsExporting(true)
    try {
      const pdf = new jsPDF()
      const pageHeight = pdf.internal.pageSize.height
      let yPosition = 10

      // Add claim details for evidence export (moved down 2 rows)
      if (exportType === 'evidence' && selectedClaim) {
        yPosition += 10 // Move down 1 row
        
        const { data: claimDetails } = await supabase
          .from('claims')
          .select('case_number, title, court, plaintiff_name, defendant_name')
          .eq('case_number', selectedClaim)
          .single()
        
        if (claimDetails) {
          pdf.setFontSize(12)
          // Two column layout for claim details
          pdf.text(`Case: ${claimDetails.case_number}`, 20, yPosition)
          pdf.text(`Title: ${claimDetails.title}`, 110, yPosition)
          yPosition += 10
          
          if (claimDetails.court || claimDetails.plaintiff_name) {
            pdf.text(`Court: ${claimDetails.court || 'N/A'}`, 20, yPosition)
            pdf.text(`Plaintiff: ${claimDetails.plaintiff_name || 'N/A'}`, 110, yPosition)
            yPosition += 10
          }
          
          if (claimDetails.defendant_name) {
            pdf.text(`Defendant: ${claimDetails.defendant_name}`, 20, yPosition)
            yPosition += 10
          }
          
          yPosition += 15 // Extra space before column headers
        }
      }

      // Add column headers for evidence export
      if (exportType === 'evidence') {
        pdf.setFontSize(10)
        pdf.setFont(undefined, 'bold')
        pdf.text('EXHIBIT #', 20, yPosition, { align: 'center' })
        pdf.text('FILE NAME', 50, yPosition)
        pdf.text('METHOD', 100, yPosition, { align: 'center' })
        pdf.text('DATE', 130, yPosition, { align: 'center' })
        pdf.text('PAGES', 155, yPosition, { align: 'center' })
        pdf.text('BUNDLE POS', 175, yPosition, { align: 'center' })
        pdf.text('CLC REF#', 195, yPosition, { align: 'center' })
        pdf.setFont(undefined, 'normal')
        yPosition += 10
      }

      // Add column headers for table of contents export
      if (exportType === 'table_of_contents') {
        pdf.setFontSize(10)
        pdf.setFont(undefined, 'bold')
        pdf.text('EXHIBIT #', 20, yPosition, { align: 'center' })
        pdf.text('FILE NAME', 60, yPosition)
        pdf.text('PAGES', 120, yPosition, { align: 'center' })
        pdf.text('BUNDLE POS', 150, yPosition, { align: 'center' })
        pdf.setFont(undefined, 'normal')
        yPosition += 10
      }

      // Calculate bundle positions for evidence
      let bundlePositions: { [key: string]: number } = {}
      if (exportType === 'evidence' && data) {
        let currentPos = 1
        // Sort data by display_order first, then by created_at to ensure correct sequence
        const sortedData = [...data].sort((a, b) => {
          // First sort by display_order (nulls last)
          if (a.display_order !== null && b.display_order !== null) {
            return a.display_order - b.display_order
          }
          if (a.display_order !== null && b.display_order === null) {
            return -1
          }
          if (a.display_order === null && b.display_order !== null) {
            return 1
          }
          // If both are null, sort by created_at
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
        
        sortedData.forEach((item) => {
          bundlePositions[item.id] = currentPos
          const pages = item.number_of_pages || 1
          currentPos += pages
        })
      }

      // Data
      pdf.setFontSize(10)
      data.forEach((item, index) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage()
          yPosition = 20
          
          // Add column headers on new page for evidence reports
          if (exportType === 'evidence') {
            pdf.setFont(undefined, 'bold')
            pdf.text('EXHIBIT #', 20, yPosition, { align: 'center' })
            pdf.text('FILE NAME', 50, yPosition)
            pdf.text('METHOD', 100, yPosition, { align: 'center' })
            pdf.text('DATE', 130, yPosition, { align: 'center' })
            pdf.text('PAGES', 155, yPosition, { align: 'center' })
            pdf.text('BUNDLE POS', 175, yPosition, { align: 'center' })
            pdf.text('CLC REF#', 195, yPosition, { align: 'center' })
            pdf.setFont(undefined, 'normal')
            yPosition += 10
          }
        }

        let text = ''
        
        if (exportType === 'evidence') {
          // For evidence, display in columns
         pdf.text(item.exhibit_id || '', 17, yPosition, { align: 'center' })
          pdf.text(item.file_name || '', 45, yPosition)
          pdf.text(item.method || '', 100, yPosition, { align: 'center' })
          pdf.text(item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : '', 130, yPosition, { align: 'center' })
          pdf.text((item.number_of_pages || '').toString(), 155, yPosition, { align: 'center' })
          pdf.text(bundlePositions[item.id]?.toString() || '', 175, yPosition, { align: 'center' })
          pdf.text(item.book_of_deeds_ref || '', 195, yPosition, { align: 'center' })
          yPosition += 8
        } else {
          // For other exports, use existing logic but exclude unwanted fields
          text = Object.entries(item)
            .filter(([key, value]) => 
              value && 
              !key.includes('id') && 
              !key.includes('user_id') &&
              key !== 'file_url' &&
              key !== 'created_at' &&
              key !== 'updated_at' &&
              key !== 'display_order'
            )
            .map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
            .join(' | ')

          const lines = pdf.splitTextToSize(text, 170)
          pdf.text(lines, 20, yPosition)
          yPosition += lines.length * 5 + 10
        }
      })

      // Open PDF in browser instead of downloading
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      window.open(pdfUrl, '_blank')
    } catch (error) {
      // Handle PDF generation error silently
    } finally {
      setIsExporting(false)
    }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!evidence && !todos && !events) return

    switch (exportType) {
      case 'evidence':
        if (evidence) {
          if (format === 'csv') {
            exportToCSV(evidence, 'evidence', ['File Name', 'Exhibit ID', 'Method', 'Number of Pages', 'Date Submitted'])
          } else {
            await exportToPDF(evidence, 'Evidence Report', 'evidence')
          }
        }
        break
      case 'todos':
        if (todos) {
          if (format === 'csv') {
            exportToCSV(todos, 'todos', ['Title', 'Description', 'Due Date', 'Priority', 'Completed'])
          } else {
            await exportToPDF(todos, 'Todo List Report', 'todos')
          }
        }
        break
      case 'calendar':
        if (events) {
          if (format === 'csv') {
            exportToCSV(events, 'calendar', ['Title', 'Description', 'Start Time', 'End Time', 'All Day'])
          } else {
            await exportToPDF(events, 'Calendar Events Report', 'calendar')
          }
        }
        break
    }
  }

  const downloadDocumentsZip = async () => {
    if (!evidence || evidence.length === 0) return
    
    setIsDownloadingZip(true)
    try {
      const zip = new JSZip()
      const documentsFolder = zip.folder('evidence-documents')
      
      // Filter evidence that has file URLs
      const evidenceWithFiles = evidence.filter(item => item.file_url && item.file_url.trim())
      
      if (evidenceWithFiles.length === 0) {
        alert('No documents found to download. Evidence items need file URLs to be included in the ZIP.')
        return
      }
      
      // Download each file and add to ZIP
      const downloadPromises = evidenceWithFiles.map(async (item, index) => {
        try {
          const response = await fetch(item.file_url!)
          if (!response.ok) {
            return null
          }
          
          const blob = await response.blob()
          const fileName = item.file_name || `exhibit-${item.exhibit_id || index + 1}`
          
          // Add exhibit ID prefix to filename for organization
          const prefixedFileName = item.exhibit_id 
            ? `${item.exhibit_id} - ${fileName}`
            : fileName
          
          documentsFolder?.file(prefixedFileName, blob)
          return prefixedFileName
        } catch (error) {
          return null
        }
      })
      
      const results = await Promise.all(downloadPromises)
      const successfulDownloads = results.filter(Boolean)
      
      if (successfulDownloads.length === 0) {
        alert('No documents could be downloaded. Please check that the file URLs are accessible.')
        return
      }
      
      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      
      const link = document.createElement('a')
      link.href = zipUrl
      link.download = selectedClaim 
        ? `${selectedClaim}-evidence-documents.zip`
        : 'evidence-documents.zip'
      link.click()
      
      // Cleanup
      URL.revokeObjectURL(zipUrl)
      
      alert(`Successfully downloaded ${successfulDownloads.length} documents out of ${evidenceWithFiles.length} available.`)
      
    } catch (error) {
      alert('Error creating ZIP file. Please try again.')
    } finally {
      setIsDownloadingZip(false)
    }
  }

  const getDataCount = () => {
    switch (exportType) {
      case 'evidence': return evidence?.length || 0
      case 'todos': return todos?.length || 0
      case 'calendar': return events?.length || 0
      default: return 0
    }
  }

  return (
    <div className="space-y-6">
      {selectedClaim && (
        <div className="border-l-4 rounded-lg p-4 border-yellow-400/60">
          <p className="text-gold">
            Exporting data for selected claim: <strong>{selectedClaim}</strong>
          </p>
        </div>
      )}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={navigateBack}
            className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <button
            onClick={() => navigateTo('claims')}
            className="bg-white/10 border border-green-400 text-green-400 px-3 py-1 rounded-lg flex items-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-center flex-1">Export Features</h2>
        <div />
      </div>
      <p className="text-gray-600">
        Export your legal data in various formats for backup or sharing.
        {selectedClaim ? ' Currently showing data for the selected claim only.' : ' Showing all data.'}
      </p>

      <div className="card-enhanced p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold mb-4">Export Options</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Data to Export</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button
                onClick={() => setExportType('evidence')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'evidence' 
                    ? 'text-white' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={exportType === 'evidence' ? { 
                  borderColor: claimColor, 
                  backgroundColor: `${claimColor}20`,
                  color: claimColor
                } : {}}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Evidence</div>
                <div className="text-xs text-gray-500">{evidence?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('todos')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'todos' 
                    ? 'text-white' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={exportType === 'todos' ? { 
                  borderColor: claimColor, 
                  backgroundColor: `${claimColor}20`,
                  color: claimColor
                } : {}}
              >
                <CheckSquare className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Todos</div>
                <div className="text-xs text-gray-500">{todos?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('calendar')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'calendar' 
                    ? 'text-white' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={exportType === 'calendar' ? { 
                  borderColor: claimColor, 
                  backgroundColor: `${claimColor}20`,
                  color: claimColor
                } : {}}
              >
                <Calendar className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Calendar</div>
                <div className="text-xs text-gray-500">{events?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('table_of_contents')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'table_of_contents' 
                    ? 'text-white' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={exportType === 'table_of_contents' ? { 
                  borderColor: claimColor, 
                  backgroundColor: `${claimColor}20`,
                  color: claimColor
                } : {}}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Table of Contents</div>
                <div className="text-xs text-gray-500">{evidence?.length || 0} items</div>
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Export Format</h4>
            <div className="flex space-x-4">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting || getDataCount() === 0}
                className="bg-blue-900/30 border-2 border-green-500 text-green-500 px-6 py-3 rounded-lg hover:bg-blue-800/50 hover:border-green-400 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export as CSV</span>
              </button>
              
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting || getDataCount() === 0}
                className="bg-blue-900/30 border-2 border-green-500 text-green-500 px-6 py-3 rounded-lg hover:bg-blue-800/50 hover:border-green-400 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Generating PDF...' : 'Export as PDF'}</span>
              </button>
              
              {exportType === 'evidence' && (
                <button
                  onClick={downloadDocumentsZip}
                  disabled={isDownloadingZip || !evidence || evidence.length === 0}
                  className="bg-blue-900/30 border-2 border-green-500 text-green-500 px-6 py-3 rounded-lg hover:bg-blue-800/50 hover:border-green-400 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloadingZip ? 'Creating ZIP...' : 'Download Documents ZIP'}</span>
                </button>
              )}
            </div>
          </div>

          {getDataCount() === 0 && (
            <div className="card-smudge p-4">
              <p className="text-yellow-800 text-sm">
                No data available for the selected export type. Add some data first to enable exports.
              </p>
            </div>
          )}
          
          {exportType === 'evidence' && evidence && evidence.filter(item => item.file_url).length === 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-800 text-sm">
                No documents with file URLs found. Upload files or add file URLs to evidence items to enable ZIP download.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card-smudge p-4">
        <h4 className="font-medium text-blue-900 mb-2">Export Information</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• CSV exports are ideal for importing into spreadsheet applications</li>
          <li>• PDF exports provide formatted reports suitable for printing or sharing</li>
          <li>• ZIP downloads include all uploaded documents organized by exhibit ID</li>
          <li>• All exports exclude sensitive system data like user IDs</li>
          <li>• Large datasets may take a moment to process</li>
        </ul>
      </div>
    </div>
  )
}

export default ExportFeatures