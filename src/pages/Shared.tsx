import { Navigation } from "@/components/Navigation";
import { SharedClaimsList } from "@/components/SharedClaimsList";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InHouseCalendar } from "@/components/InHouseCalendar";
import { useClaims } from "@/hooks/useClaims";
import { useEvidence } from "@/hooks/useEvidence";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CollaborationHub } from "@/components/CollaborationHub";

const Shared = () => {
  const navigate = useNavigate();
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const { claims } = useClaims();
  const { evidence } = useEvidence();

  const handleSelectClaim = (claimId: string) => {
    navigate(`/?claimId=${claimId}`);
  };

  const handleReturnToClaim = () => {
    if (selectedClaimId) {
      navigate(`/?claimId=${selectedClaimId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto p-4">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Shared Claims & Collaboration
            </h1>
            <p className="text-muted-foreground">
              Manage shared claims, collaborate, and track tasks across all your shared projects
            </p>
          </div>
          
          <Tabs defaultValue="shared" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="shared">Shared Claims</TabsTrigger>
              <TabsTrigger value="calendar">Calendar & Tasks</TabsTrigger>
              <TabsTrigger value="collaboration">Collaboration Hub</TabsTrigger>
            </TabsList>

            <TabsContent value="shared" className="space-y-4">
              <SharedClaimsList onSelectClaim={handleSelectClaim} />
            </TabsContent>

            <TabsContent value="calendar" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">Shared Task Calendar</h2>
                  {selectedClaimId && (
                    <Button variant="outline" size="sm" onClick={handleReturnToClaim}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Claim
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Filter by claim:</span>
                    <Select onValueChange={(value) => setSelectedClaimId(value === "all" ? null : value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All claims" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All claims</SelectItem>
                        {claims?.map((claim) => (
                          <SelectItem key={claim.case_number} value={claim.case_number}>
                            {claim.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <InHouseCalendar 
                selectedClaimId={selectedClaimId} 
                claims={claims} 
                evidence={evidence}
              />
            </TabsContent>

            <TabsContent value="collaboration" className="space-y-4">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Collaboration Tools</h2>
                  <p className="text-muted-foreground mb-6">
                    Access collaboration features for your shared claims
                  </p>
                </div>
                
                {selectedClaimId ? (
                  <CollaborationHub claimId={selectedClaimId} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Choose a Claim from the filter above to access collaboration tools
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Shared;