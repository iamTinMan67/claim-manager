
import { useState } from "react";
import { Claim } from "@/hooks/useClaims";
import { Evidence } from "@/hooks/useEvidence";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Download, FileText, Settings, CheckSquare, MessageSquare } from "lucide-react";
import { generateClaimEvidencePDF, generateToDoListPDF, generateCommunicationLogPDF } from "@/utils/pdfExport";
import { toast } from "@/hooks/use-toast";
import { PDFFieldSelector } from "./PDFFieldSelector";
import { 
  PDFFieldConfig, 
  DEFAULT_CLAIM_FIELDS, 
  DEFAULT_EVIDENCE_FIELDS 
} from "@/types/pdfConfig";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  claim: Claim;
  evidenceList: Evidence[];
  allClaims: Claim[];
  allEvidence: Evidence[];
}

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

export const ClaimEvidenceExport = ({ claim, evidenceList, allClaims, allEvidence }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<PDFFieldConfig>({
    claimFields: DEFAULT_CLAIM_FIELDS,
    evidenceFields: DEFAULT_EVIDENCE_FIELDS,
  });

  // Fetch communication logs for this claim
  const { data: communicationLogs = [] } = useQuery({
    queryKey: ['communication-logs-export', claim.claim_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('claim_id', claim.claim_id)
        .order('date', { ascending: false }); // Newest first
      
      if (error) throw error;
      return data as CommunicationLog[];
    },
  });

  const handleExportClaimEvidence = async (config?: PDFFieldConfig) => {
    setGenerating(true);
    try {
      // Debug: Log the evidence list being passed to PDF generator
      console.log('[ClaimEvidenceExport] Evidence list being exported:', evidenceList);
      evidenceList.forEach((evidence, idx) => {
        console.log(`[ClaimEvidenceExport] Evidence ${idx}: exhibit_number = ${(evidence as any).exhibit_number}, file_name = "${evidence.file_name}"`);
      });
      
      const configToUse = config || fieldConfig;
      const pdf = generateClaimEvidencePDF(claim, evidenceList, configToUse);
      const fileName = `${claim.case_number}_Evidence_Report.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "Export Successful",
        description: `Evidence report saved as ${fileName}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleFieldConfigConfirm = (config: PDFFieldConfig) => {
    setFieldConfig(config);
    handleExportClaimEvidence(config);
  };

  // Helper function to extract numeric exhibit number
  const getExhibitNumber = (evidence: Evidence): number | null => {
    const exhibitNum = (evidence as any).exhibit_number;
    if (exhibitNum !== null && exhibitNum !== undefined) {
      // If it's already a number, return it
      if (typeof exhibitNum === 'number') {
        return exhibitNum;
      }
      // If it's a string, try to extract the number
      if (typeof exhibitNum === 'string') {
        // Remove "Exhibit " prefix if present and extract number
        const match = exhibitNum.replace(/^Exhibit\s*/i, '').match(/\d+/);
        if (match) {
          return parseInt(match[0], 10);
        }
        // Try parsing the whole string as a number
        const parsed = parseInt(exhibitNum, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  };

  const exportEvidenceCSV = () => {
    // Sort evidence by exhibit number before exporting
    const sortedEvidence = [...evidenceList].sort((a, b) => {
      const aExhibitNum = getExhibitNumber(a);
      const bExhibitNum = getExhibitNumber(b);
      
      // Both have exhibit numbers - sort numerically
      if (aExhibitNum !== null && bExhibitNum !== null) {
        return aExhibitNum - bExhibitNum;
      }
      
      // Only one has exhibit number - items with exhibit numbers come first
      if (aExhibitNum !== null && bExhibitNum === null) {
        return -1;
      }
      if (aExhibitNum === null && bExhibitNum !== null) {
        return 1;
      }
      
      // Neither has exhibit number - fall back to display_order
      if (a.display_order !== null && b.display_order !== null) {
        return a.display_order - b.display_order;
      }
      if (a.display_order !== null) return -1;
      if (b.display_order !== null) return 1;
      
      // Finally, sort by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const headers = ['Exhibit Number', 'File Name', 'Created Date', 'Claims Count'];
    const csvContent = [
      headers.join(','),
      ...sortedEvidence.map(evidence => {
        const exhibitNum = (evidence as any).exhibit_number;
        const exhibitValue = exhibitNum !== null && exhibitNum !== undefined ? exhibitNum : '';
        return [
          `"${exhibitValue}"`,
          `"${evidence.file_name || 'Evidence Item'}"`,
          `"${new Date(evidence.created_at).toLocaleDateString()}"`,
          evidence.claimIds.length
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${claim.case_number}_Evidence_Data.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV Export Successful",
      description: `Evidence data saved as ${claim.case_number}_Evidence_Data.csv`,
    });
  };

  const handleExportToDoList = async () => {
    setGenerating(true);
    try {
      const pdf = generateToDoListPDF(allEvidence, allClaims);
      const fileName = 'ToDo_List.pdf';
      pdf.save(fileName);
      
      toast({
        title: "To-Do List Export Successful",
        description: `To-Do list saved as ${fileName}`,
      });
    } catch (error) {
      console.error('Error generating To-Do PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate To-Do list PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCommunicationLog = async () => {
    setGenerating(true);
    try {
      if (communicationLogs.length === 0) {
        toast({
          title: "No Communication Logs",
          description: "There are no communication logs for this claim to export.",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const pdf = generateCommunicationLogPDF(claim, communicationLogs);
      const fileName = `${claim.case_number}_Communication_Log.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "Communication Log Export Successful",
        description: `Communication log saved as ${fileName}`,
      });
    } catch (error) {
      console.error('Error generating Communication Log PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Communication Log PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Claim Evidence Report</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate a comprehensive PDF report for this claim including all evidence items, descriptions, and file attachments.
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => setShowFieldSelector(true)}
              disabled={generating}
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              {generating ? "Generating PDF..." : "Customize & Download PDF"}
            </Button>
            <Button 
              onClick={() => handleExportClaimEvidence()}
              disabled={generating}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              {generating ? "Generating PDF..." : "Quick Download PDF"}
            </Button>
            <Button 
              onClick={exportEvidenceCSV}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5" />
            <span>To-Do List</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate a printable To-Do list from all evidence items marked with "To-Do" method across all cases.
          </p>
          <Button 
            onClick={handleExportToDoList}
            disabled={generating}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {generating ? "Generating To-Do List..." : "Download To-Do List PDF"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Communication Log</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate a PDF report of all communication logs for this claim. Newest entries appear at the top, oldest at the bottom.
          </p>
          <Button 
            onClick={handleExportCommunicationLog}
            disabled={generating || communicationLogs.length === 0}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {generating ? "Generating PDF..." : `Download Communication Log PDF (${communicationLogs.length} entries)`}
          </Button>
          {communicationLogs.length === 0 && (
            <p className="text-xs text-gray-500 text-center">
              No communication logs found for this claim.
            </p>
          )}
        </CardContent>
      </Card>

      <PDFFieldSelector
        open={showFieldSelector}
        onClose={() => setShowFieldSelector(false)}
        initialConfig={fieldConfig}
        onConfirm={handleFieldConfigConfirm}
      />
    </div>
  );
};
