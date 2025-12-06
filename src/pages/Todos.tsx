import { Navigation } from "@/components/Navigation";
import { EnhancedTodoList } from "@/components/EnhancedTodoList";
import { useClaims } from "@/hooks/useClaims";
import { useEvidence } from "@/hooks/useEvidence";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const Todos = () => {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const { claims } = useClaims();
  const { evidence } = useEvidence();

  const selectedClaim = claims.find(claim => claim.case_number === selectedClaimId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto p-4">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              To-Do List
            </h1>
            <p className="text-muted-foreground">
              Manage your tasks and deadlines across all claims
            </p>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Select value={selectedClaimId || "all"} onValueChange={(value) => setSelectedClaimId(value === "all" ? null : value)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filter by claim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Claims</SelectItem>
                  {claims.map((claim) => (
                    <SelectItem key={claim.case_number} value={claim.case_number}>
                      {claim.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClaimId && (
                <Button variant="outline" size="sm" onClick={() => setSelectedClaimId(null)}>
                  Clear Filter
                </Button>
              )}
            </div>
          </div>
          
          <EnhancedTodoList 
            selectedClaimId={selectedClaimId}
            claims={claims}
            evidence={evidence}
            title={selectedClaim ? `Tasks for ${selectedClaim.title}` : "All Tasks"}
            maxHeight="calc(100vh - 300px)"
          />
        </div>
      </div>
    </div>
  );
};

export default Todos;