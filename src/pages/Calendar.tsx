
import { Navigation } from "@/components/Navigation";
import { InHouseCalendar } from "@/components/InHouseCalendar";
import { useClaims } from "@/hooks/useClaims";
import { useEvidence } from "@/hooks/useEvidence";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar as CalendarIcon, Clock } from "lucide-react";

const Calendar = () => {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const { claims } = useClaims();
  const { evidence } = useEvidence();

  const selectedClaim = claims.find(claim => claim.case_number === selectedClaimId);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-4">
        <div className="bg-card shadow-sm rounded-lg p-6 max-w-7xl mx-auto border">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
                  <CalendarIcon className="h-8 w-8 text-primary" />
                  Calendar & Tasks
                </h1>
                <p className="text-muted-foreground">
                  Manage your tasks and calendar events
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold text-foreground">Task Calendar</h2>
                </div>
                <div className="flex items-center gap-4">
                  <Select value={selectedClaimId || "all"} onValueChange={(value) => setSelectedClaimId(value === "all" ? null : value)}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select active claim" />
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
              
              {selectedClaim && (
                <div className="mt-4 p-3 bg-primary/10 rounded-md border border-primary/20">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="default">{selectedClaim.case_number}</Badge>
                    <span className="font-medium text-primary">{selectedClaim.title}</span>
                    {selectedClaim.status && (
                      <Badge variant="secondary" className="ml-auto">
                        {selectedClaim.status}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <InHouseCalendar 
              selectedClaimId={selectedClaimId}
              claims={claims}
              evidence={evidence}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
