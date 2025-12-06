
import { useState } from "react";
import { Claim } from "@/hooks/useClaims";
import { Evidence } from "@/hooks/useEvidence";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Download, FileText, Settings, CheckSquare } from "lucide-react";
import { generateClaimEvidencePDF, generateToDoListPDF } from "@/utils/pdfExport";
import { toast } from "@/hooks/use-toast";
import { PDFFieldSelector } from "./PDFFieldSelector";
import { 
  PDFFieldConfig, 
  DEFAULT_CLAIM_FIELDS, 
  DEFAULT_EVIDENCE_FIELDS 
} from "@/types/pdfConfig";

interface Props {
  claim: Claim;
  evidenceList: Evidence[];
  allClaims: Claim[];
  allEvidence: Evidence[];
}

export const ClaimEvidenceExport = ({ claim, evidenceList, allClaims, allEvidence }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<PDFFieldConfig>({
    claimFields: DEFAULT_CLAIM_FIELDS,
    evidenceFields: DEFAULT_EVIDENCE_FIELDS,
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

  const exportEvidenceCSV = () => {
    const headers = ['Exhibit Number', 'File Name', 'Created Date', 'Claims Count'];
    const csvContent = [
      headers.join(','),
      ...evidenceList.map(evidence => {
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

      <PDFFieldSelector
        open={showFieldSelector}
        onClose={() => setShowFieldSelector(false)}
        initialConfig={fieldConfig}
        onConfirm={handleFieldConfigConfirm}
      />
    </div>
  );
};
