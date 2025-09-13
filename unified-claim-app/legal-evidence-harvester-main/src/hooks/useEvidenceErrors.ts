
import { toast } from '@/hooks/use-toast';
import { isAuthError } from '@/utils/authUtils';
import { useAuth } from '@/contexts/AuthContext';

export const useEvidenceErrors = () => {
  const { refreshUserSession } = useAuth();

  const handleError = (error: any, operation: string) => {
    console.error(`Error ${operation}:`, error);
    
    if (isAuthError(error)) {
      toast({
        title: "Authentication Error",
        description: "Your session has expired. Please try refreshing the page or logging in again.",
        variant: "destructive",
      });
      // Automatically attempt to refresh session
      setTimeout(() => {
        refreshUserSession();
      }, 1000);
    } else {
      toast({
        title: "Error",
        description: `Failed to ${operation}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleSuccess = (message: string) => {
    toast({
      title: "Success",
      description: message,
    });
  };

  const handleWarning = (message: string) => {
    toast({
      title: "Warning",
      description: message,
      variant: "destructive",
    });
  };

  return { handleError, handleSuccess, handleWarning };
};
