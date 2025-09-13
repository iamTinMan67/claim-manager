
import { Navigation } from "@/components/Navigation";
import { AddClaimModal } from "@/components/AddClaimModal";
import { Button } from "@/components/ui/button";

interface Props {
  showAddClaim: boolean;
  setShowAddClaim: (show: boolean) => void;
  onAddClaim: (claimData: any) => Promise<void>;
}

export const WelcomeScreen = ({ showAddClaim, setShowAddClaim, onAddClaim }: Props) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto p-4">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4 text-gray-900">
            Welcome to Claim Manager
          </h1>
          <p className="text-gray-600 mb-6">
            Get started by creating your first claim to begin managing evidence and documentation.
          </p>
          <Button
            onClick={() => setShowAddClaim(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Your First Claim
          </Button>
        </div>

        {showAddClaim && (
          <AddClaimModal
            onClose={() => setShowAddClaim(false)}
            onAdd={onAddClaim}
          />
        )}
      </div>
    </div>
  );
};
