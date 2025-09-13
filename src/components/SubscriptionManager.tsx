import React from 'react'
import { DollarSign } from 'lucide-react'


const SubscriptionManager = () => {

  return (
    <div className="space-y-8">

      {/* Guest Access Pricing Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">Guest Access Pricing</h3>
        </div>
        <p className="text-blue-800 text-sm mb-4">
          When sharing claims with additional guests beyond your first free guest, the following pricing applies:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">First Guest</div>
            <div className="text-green-600 font-bold">FREE</div>
          </div>
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">2nd Guest</div>
            <div className="text-blue-600 font-bold">£7</div>
          </div>
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">3-5 Guests</div>
            <div className="text-blue-600 font-bold">£10</div>
          </div>
          <div className="bg-white p-3 rounded border">
            <div className="font-medium text-gray-900">6+ Guests</div>
            <div className="text-blue-600 font-bold">£20</div>
            <div className="text-xs text-gray-500 mt-1">+ Frontend files & database setup</div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded border">
          <h4 className="font-medium text-gray-900 mb-2">Account Requirements</h4>
          <p className="text-sm text-gray-700">
            <strong>All guests must have their own registered account</strong> on this app before they can be invited. 
            This allows them to create and manage their own claims and have full account functionality beyond just guest access.
          </p>
        </div>
        <p className="text-blue-800 text-sm mt-3">
          <strong>Note:</strong> First guest is FREE! Payment required for additional guests. 
          £20 tier includes complete frontend files and database setup for unlimited storage beyond fair usage policy. 
          All payments support app development. Each user can be both a claim owner (hosting their own claims) and a guest (invited to others' claims).
        </p>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">Can I change my plan anytime?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">What happens to my data if I downgrade?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Your data is never deleted. If you exceed limits, you'll need to upgrade or remove content to continue adding new items.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">What features are included for free?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Text, chat and even a drawing board completely FREE! Upload, share and store information in the cloud.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">How does guest pricing work?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Your first guest is always free. Additional guests require a one-time payment that supports app development. 
              All guests must have registered accounts before being invited.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionManager