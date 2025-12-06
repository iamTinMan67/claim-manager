
import { Claim } from "@/hooks/useClaims";
import { Evidence } from "@/hooks/useEvidence";
import { EditableClaimInfo } from "./EditableClaimInfo";
import { Button } from "./ui/button";
import { Printer, Download, Share2 } from "lucide-react";
import { exportClaimDataToCSV } from "@/utils/claimDataExport";
import { toast } from "@/hooks/use-toast";

interface Props {
  evidenceCount: number;
  claim?: Claim;
  evidenceList?: Evidence[];
  onUpdateClaim?: (claimId: string, updates: Partial<Claim>) => void;
}

export const EvidenceSummary = ({ evidenceCount, claim, evidenceList, onUpdateClaim }: Props) => {
  if (!evidenceList || evidenceList.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No evidence items found.</p>
      </div>
    );
  }

  const removeFileExtension = (fileName: string | null) => {
    if (!fileName) return 'No file';
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!claim) {
      toast({
        title: "Error",
        description: "No claim data available for download.",
        variant: "destructive",
      });
      return;
    }

    try {
      await exportClaimDataToCSV(claim.case_number, claim.title);
      toast({
        title: "Download Complete",
        description: "Summary data has been downloaded as CSV.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download summary data.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!claim) return;

    const shareData = {
      title: `Claim Summary: ${claim.title}`,
      text: `Summary for case ${claim.case_number} - ${evidenceCount} evidence items`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        toast({
          title: "Copied to Clipboard",
          description: "Summary information has been copied to your clipboard.",
        });
      }
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Unable to share summary data.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 print:hidden">
        <Button variant="outline" onClick={handlePrint} size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownload} size="sm">
          <Download className="w-4 h-4 mr-2" />
          Download CSV
        </Button>
        <Button variant="outline" onClick={handleShare} size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      {/* Claim Information - only on first page */}
      {claim && onUpdateClaim && (
        <EditableClaimInfo claim={claim} onUpdate={onUpdateClaim} />
      )}

      {/* Evidence List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Evidence Items</h3>
          <span className="text-sm text-gray-500">{evidenceCount} items</span>
        </div>
        
        {/* Column Headers - description removed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 pb-2 border-b border-gray-200">
          <div className="font-medium text-gray-600 text-sm">Exhibit ID</div>
          <div className="font-medium text-gray-600 text-sm">File Name</div>
          <div className="font-medium text-gray-600 text-sm">Pages</div>
          <div className="font-medium text-gray-600 text-sm">URL Link</div>
          <div className="font-medium text-gray-600 text-sm">Date Submitted</div>
          <div className="font-medium text-gray-600 text-sm">Method</div>
        </div>

        <div className="space-y-3">
          {evidenceList.map((evidence, index) => (
            <div key={evidence.id} className="bg-white border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="flex flex-wrap">
                  <span className="text-gray-900">{(evidence as any).exhibit_number || 'N/A'}</span>
                </div>
                <div className="flex flex-wrap">
                  <span className="text-gray-900">{removeFileExtension(evidence.file_name)}</span>
                </div>
                <div className="flex flex-wrap">
                  <span className="text-gray-900">{evidence.number_of_pages || 'N/A'}</span>
                </div>
                <div className="flex flex-wrap">
                  {evidence.url_link ? (
                    <a 
                      href={evidence.url_link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Link
                    </a>
                  ) : (
                    <span className="text-gray-900">N/A</span>
                  )}
                </div>
                <div className="flex flex-wrap">
                  <span className="text-gray-900">{formatDate(evidence.date_submitted)}</span>
                </div>
                <div className="flex flex-wrap">
                  <span className="text-gray-900">{evidence.method || 'N/A'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
