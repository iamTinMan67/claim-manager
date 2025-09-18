
import { Claim } from "@/types/claim";
import { Evidence } from "@/hooks/useEvidence";
import { getClaimColor } from "@/utils/claimColors";

interface Props {
  claims: Claim[];
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
  evidenceList: Evidence[];
}

export const ClaimsList = ({ claims, selectedClaimId, onSelectClaim, evidenceList }: Props) => {
  const getEvidenceCount = (caseNumber: string) => {
    return evidenceList.filter(evidence => evidence.claimIds.includes(caseNumber)).length;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Closed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const claimColor = getClaimColor(claim.case_number);
        return (
          <div
            key={claim.case_number}
            onClick={() => onSelectClaim(claim.case_number)}
            className={`p-4 border-l-4 rounded-lg cursor-pointer transition-all hover:shadow-md ${claimColor.border} ${
              selectedClaimId === claim.case_number 
                ? `${claimColor.bg} border-2 shadow-md` 
                : "border bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${claimColor.border.replace('border', 'bg')}`}></div>
                <h3 className="font-semibold text-gray-900 text-sm">{claim.title}</h3>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                {claim.status}
              </span>
            </div>
            
            <p className="text-xs text-gray-600 mb-2">{claim.case_number}</p>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{claim.description}</p>
            
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>{getEvidenceCount(claim.case_number)} evidence items</span>
              <span>{new Date(claim.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
