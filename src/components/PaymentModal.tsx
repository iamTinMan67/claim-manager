import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/integrations/supabase/client'
import { X, CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  currency?: string
  paymentType: 'guest_access' | 'subscription' | 'one_time'
  claimId?: string
  guestEmail?: string
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
}

const PaymentForm = ({ 
  amount, 
  currency = 'gbp', 
  paymentType, 
  claimId, 
  guestEmail, 
  onSuccess, 
  onError, 
  onClose 
}: Omit<PaymentModalProps, 'isOpen'>) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    // Create payment intent when component mounts
    createPaymentIntent()
  }, [])

  const createPaymentIntent = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          payment_type: paymentType,
          claim_id: claimId,
          guest_email: guestEmail,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent')
      }

      setClientSecret(data.client_secret)
    } catch (error) {
      onError(error.message)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setIsProcessing(true)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setIsProcessing(false)
      return
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
      },
    })

    setIsProcessing(false)

    if (error) {
      onError(error.message || 'Payment failed')
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card-smudge p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Payment Details</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Amount: <span className="font-semibold">{formatAmount(amount, currency)}</span></p>
          <p>Type: <span className="capitalize">{paymentType.replace('_', ' ')}</span></p>
          {claimId && <p>Claim: {claimId}</p>}
          {guestEmail && <p>Guest: {guestEmail}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Information
          </label>
          <div className="border rounded-lg p-3 card-enhanced">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="card-smudge p-4">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Secure Payment</span>
          </div>
          <p className="text-sm text-blue-800 mt-1">
            Your payment information is encrypted and secure. We use Stripe for payment processing.
          </p>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          type="submit"
          disabled={!stripe || isProcessing || !clientSecret}
          className="flex-1 bg-blue-900/30 border-2 border-green-500 text-green-500 px-4 py-3 rounded-lg hover:bg-blue-800/50 hover:border-green-400 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>Pay {formatAmount(amount, currency)}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-500/20 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

const PaymentModal = (props: PaymentModalProps) => {
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const handleSuccess = (paymentIntentId: string) => {
    setPaymentStatus('success')
    setStatusMessage('Payment successful! Access has been granted.')
    props.onSuccess(paymentIntentId)
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      props.onClose()
      setPaymentStatus('idle')
      setStatusMessage('')
    }, 3000)
  }

  const handleError = (error: string) => {
    setPaymentStatus('error')
    setStatusMessage(error)
    props.onError(error)
  }

  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card-enhanced rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Complete Payment</h3>
          <button
            onClick={props.onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={paymentStatus === 'success'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paymentStatus === 'success' && (
          <div className="card-smudge p-4 mb-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Payment Successful!</span>
            </div>
            <p className="text-sm text-green-800 mt-1">{statusMessage}</p>
          </div>
        )}

        {paymentStatus === 'error' && (
          <div className="card-smudge p-4 mb-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-900">Payment Failed</span>
            </div>
            <p className="text-sm text-red-800 mt-1">{statusMessage}</p>
          </div>
        )}

        {paymentStatus === 'idle' && (
          <>
            {!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? (
              <div className="card-smudge p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-900">Payment Configuration Required</span>
                </div>
                <p className="text-sm text-yellow-800 mt-1">
                  Stripe payment processing is not configured. Please contact support to enable payments.
                </p>
              </div>
            ) : (
              <Elements stripe={stripePromise}>
                <PaymentForm
                  amount={props.amount}
                  currency={props.currency}
                  paymentType={props.paymentType}
                  claimId={props.claimId}
                  guestEmail={props.guestEmail}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  onClose={props.onClose}
                />
              </Elements>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentModal