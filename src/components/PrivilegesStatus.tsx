import React from 'react';
import { usePrivileges } from '@/hooks/usePrivileges';
import { Crown, Shield, Star, CheckCircle, XCircle } from 'lucide-react';

const PrivilegesStatus: React.FC = () => {
  const { 
    hasExclusive, 
    hasAdmin, 
    adminTier, 
    hasValidAccess, 
    hasPremium, 
    loading,
    refreshPrivileges 
  } = usePrivileges();

  if (loading) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700 mr-2"></div>
          Checking privileges...
        </div>
      </div>
    );
  }

  const getAdminTierColor = (tier: string | null) => {
    switch (tier) {
      case 'developer': return 'text-purple-600 bg-purple-100';
      case 'admin': return 'text-red-600 bg-red-100';
      case 'moderator': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAdminTierIcon = (tier: string | null) => {
    switch (tier) {
      case 'developer': return <Crown className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'moderator': return <Star className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Your Privileges Status</h3>
        <button
          onClick={refreshPrivileges}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {/* Exclusive Privileges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Crown className="w-5 h-5 text-purple-600 mr-2" />
            <span className="font-medium">Exclusive Privileges</span>
          </div>
          {hasExclusive ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* Admin Tier */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getAdminTierIcon(adminTier)}
            <span className="font-medium ml-2">Admin Tier</span>
          </div>
          {hasAdmin ? (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAdminTierColor(adminTier)}`}>
              {adminTier?.toUpperCase()}
            </span>
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* Valid Access */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
            <span className="font-medium">Valid Access</span>
          </div>
          {hasValidAccess ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* Premium Access */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Star className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-medium">Premium Access</span>
          </div>
          {hasPremium ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          {hasExclusive ? (
            <span className="text-purple-600 font-medium">
              🎉 You have EXECUTIVE PRIVILEGES! You can bypass all subscription checks and limitations.
            </span>
          ) : hasAdmin ? (
            <span className="text-blue-600 font-medium">
              🔧 You have ADMIN ACCESS with {adminTier} privileges.
            </span>
          ) : hasValidAccess ? (
            <span className="text-green-600 font-medium">
              ✅ You have valid access to the application.
            </span>
          ) : (
            <span className="text-red-600 font-medium">
              ❌ You do not have valid access. Please contact support.
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default PrivilegesStatus;
