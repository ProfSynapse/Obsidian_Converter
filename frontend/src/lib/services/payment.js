import { loadStripe } from '@stripe/stripe-js';
import { paymentStore } from '../stores/payment';
import { browser } from '$app/environment';

class PaymentService {
  constructor() {
    this.stripe = null;
    this.elements = null;
    // Only initialize in browser environment
    if (browser) {
      this.init();
    }
  }

  async init() {
    try {
      const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
      
      if (!publicKey) {
        throw new Error('Stripe public key not found in environment');
      }

      this.stripe = await loadStripe(publicKey);
      if (this.stripe) {
        this.elements = this.stripe.elements();
        console.log('✨ Stripe initialized successfully');
      } else {
        throw new Error('Failed to initialize Stripe');
      }
    } catch (error) {
      console.error('🚫 Error initializing Stripe:', error);
      throw error; // Re-throw to handle in component
    }
  }

  createCardElement(options = {}) {
    if (!this.elements) {
      throw new Error('Stripe Elements not initialized');
    }
    return this.elements.create('card', {
      style: {
        base: {
          color: 'var(--color-text)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          '::placeholder': {
            color: 'var(--color-text-light)',
          },
        },
      },
      ...options
    });
  }

  async initiatePayment(amount) {
    try {
      console.log('💫 Initiating payment for amount:', amount);
      paymentStore.startProcessing();
      
      // Send amount in cents to backend
      const response = await fetch('https://backend-production-6e08.up.railway.app/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100) })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to initiate payment');
      }

      const { clientSecret } = await response.json();
      paymentStore.setClientSecret(clientSecret);
      return clientSecret;
    } catch (error) {
      console.error('🚫 Payment initiation failed:', error);
      paymentStore.setStatus('failed');
      paymentStore.setError(error.message);
      throw error;
    }
  }

  async confirmPayment(clientSecret) {
    try {
      console.log('🔄 Confirming payment...');
      
      if (!this.stripe) {
        throw new Error('Stripe not initialized');
      }

      const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret);
      
      if (error) {
        throw error;
      }

      if (paymentIntent.status === 'succeeded') {
        console.log('✅ Payment confirmed successfully!');
        paymentStore.setStatus('completed');
        paymentStore.setError(null);
        return true;
      }

      throw new Error(`Payment status: ${paymentIntent.status}`);
    } catch (error) {
      console.error('🚫 Payment confirmation failed:', error);
      paymentStore.setStatus('failed');
      paymentStore.setError(error.message);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
