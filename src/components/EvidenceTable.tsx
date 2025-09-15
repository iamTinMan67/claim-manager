import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Evidence } from '@/types/database'

const EvidenceTable = () => {
  const { data: evidence, isLoading, error } = useQuery({
    queryKey: ['evidence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence')
        .select(`
          *,
          date_submitted::text
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Clean up empty string dates
      const cleanedData = data?.map(item => ({
        ...item,
        date_submitted: item.date_submitted === '' ? null : item.date_submitted
      })) || []
      
      return cleanedData as Evidence[]
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading evidence...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-smudge p-4">
        <div className="text-red-800">Error loading evidence: {error.message}</div>
      </div>
    )
  }

  if (!evidence || evidence.length === 0) {
    return (
      <div className="card-enhanced p-8 text-center">
        <div className="text-gray-600">No evidence found</div>
      </div>
    )
  }

  return (
    <div className="card-enhanced rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Evidence</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="card-smudge">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Exhibit ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pages
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Submitted
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="card-enhanced divide-y divide-gray-200">
            {evidence.map((item) => (
              <tr key={item.id} className="hover:bg-gray-500/20">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.file_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.exhibit_id || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.method || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.number_of_pages || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.date_submitted ? new Date(item.date_submitted).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default EvidenceTable