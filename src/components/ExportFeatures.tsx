import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Download, FileText, Calendar, Users, CheckSquare } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const ExportFeatures = () => {
  const [exportType, setExportType] = useState<'claims' | 'evidence' | 'todos' | 'calendar' | 'all'>('all')
  const [isExporting, setIsExporting] = useState(false)

  const { data: claims } = useQuery({
    queryKey: ['claims-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    }
  })

  const { data: evidence } = useQuery({
    queryKey: ['evidence-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    }
  })

  const { data: todos } = useQuery({
    queryKey: ['todos-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return data
    }
  })

  const { data: events } = useQuery({
    queryKey: ['events-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
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
      let yPosition = 20

      // Title
      pdf.setFontSize(16)
      pdf.text(title, 20, yPosition)
      yPosition += 20

      // Data
      pdf.setFontSize(10)
      data.forEach((item, index) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage()
          yPosition = 20
        }

        const text = Object.entries(item)
          .filter(([key, value]) => value && !key.includes('id') && !key.includes('user_id'))
          .map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
          .join(' | ')

        const lines = pdf.splitTextToSize(text, 170)
        pdf.text(lines, 20, yPosition)
        yPosition += lines.length * 5 + 10
      })

      pdf.save(`${filename}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!claims && !evidence && !todos && !events) return

    switch (exportType) {
      case 'claims':
        if (claims) {
          if (format === 'csv') {
            exportToCSV(claims, 'claims', ['Case Number', 'Title', 'Court', 'Status', 'Created At'])
          } else {
            await exportToPDF(claims, 'Legal Claims Report', 'claims')
          }
        }
        break
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
      case 'all':
        if (format === 'csv') {
          claims && exportToCSV(claims, 'claims', ['Case Number', 'Title', 'Court', 'Status', 'Created At'])
          evidence && exportToCSV(evidence, 'evidence', ['File Name', 'Exhibit ID', 'Method', 'Number of Pages', 'Date Submitted'])
          todos && exportToCSV(todos, 'todos', ['Title', 'Description', 'Due Date', 'Priority', 'Completed'])
          events && exportToCSV(events, 'calendar', ['Title', 'Description', 'Start Time', 'End Time', 'All Day'])
        } else {
          const allData = [
            ...(claims || []).map(item => ({ ...item, type: 'Claim' })),
            ...(evidence || []).map(item => ({ ...item, type: 'Evidence' })),
            ...(todos || []).map(item => ({ ...item, type: 'Todo' })),
            ...(events || []).map(item => ({ ...item, type: 'Event' }))
          ]
          await exportToPDF(allData, 'Complete Legal Data Report', 'complete-report')
        }
        break
    }
  }

  const getDataCount = () => {
    switch (exportType) {
      case 'claims': return claims?.length || 0
      case 'evidence': return evidence?.length || 0
      case 'todos': return todos?.length || 0
      case 'calendar': return events?.length || 0
      case 'all': return (claims?.length || 0) + (evidence?.length || 0) + (todos?.length || 0) + (events?.length || 0)
      default: return 0
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Export Features</h2>
        <p className="text-gray-600">Export your legal data in various formats for backup or sharing.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold mb-4">Export Options</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Data to Export</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <button
                onClick={() => setExportType('claims')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'claims' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Claims</div>
                <div className="text-xs text-gray-500">{claims?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('evidence')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'evidence' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Evidence</div>
                <div className="text-xs text-gray-500">{evidence?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('todos')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'todos' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CheckSquare className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Todos</div>
                <div className="text-xs text-gray-500">{todos?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('calendar')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'calendar' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Calendar className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Calendar</div>
                <div className="text-xs text-gray-500">{events?.length || 0} items</div>
              </button>
              
              <button
                onClick={() => setExportType('all')}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  exportType === 'all' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Users className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">All Data</div>
                <div className="text-xs text-gray-500">{getDataCount()} items</div>
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Export Format</h4>
            <div className="flex space-x-4">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting || getDataCount() === 0}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export as CSV</span>
              </button>
              
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting || getDataCount() === 0}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Generating PDF...' : 'Export as PDF'}</span>
              </button>
            </div>
          </div>

          {getDataCount() === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                No data available for the selected export type. Add some data first to enable exports.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Export Information</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• CSV exports are ideal for importing into spreadsheet applications</li>
          <li>• PDF exports provide formatted reports suitable for printing or sharing</li>
          <li>• All exports exclude sensitive system data like user IDs</li>
          <li>• Large datasets may take a moment to process</li>
        </ul>
      </div>
    </div>
  )
}

export default ExportFeatures