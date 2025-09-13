
import { Claim } from "@/hooks/useClaims";

interface Props {
  caseInfo: Claim;
  setCaseInfo: (info: Claim) => void;
}

export const CaseInformation = ({ caseInfo, setCaseInfo }: Props) => {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Case Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Case Number
          </label>
          <input
            value={caseInfo.case_number}
            onChange={(e) =>
              setCaseInfo({ ...caseInfo, case_number: e.target.value })
            }
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Court/Tribunal
          </label>
          <input
            value={caseInfo.court || ""}
            onChange={(e) => setCaseInfo({ ...caseInfo, court: e.target.value })}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Plaintiff Name
          </label>
          <input
            value={caseInfo.plaintiff_name || ""}
            onChange={(e) =>
              setCaseInfo({ ...caseInfo, plaintiff_name: e.target.value })
            }
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Defendant Name
          </label>
          <input
            value={caseInfo.defendant_name || ""}
            onChange={(e) =>
              setCaseInfo({ ...caseInfo, defendant_name: e.target.value })
            }
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
