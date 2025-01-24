import Stripe from 'stripe';

class PaymentService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('🚨 Missing required STRIPE_SECRET_KEY environment variable');
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key');
  }

  /**
   * Creates a payment intent for pay-what-you-want donations
   * @param {number} amount Amount in cents that the user wants to pay
   * @returns {Promise<{clientSecret: string}>} Stripe payment intent client secret
   */
  async createPaymentIntent(amount) {
    try {
      console.log('🎯 Creating payment intent for amount:', amount);
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount, // amount in cents
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          type: 'donation',
          timestamp: new Date().toISOString()
        }
      });

      console.log('✅ Successfully created payment intent:', paymentIntent.id);
      
      return {
        clientSecret: paymentIntent.client_secret
      };
    } catch (error) {
      console.error('❌ Error creating payment intent:', error.message);
      throw error;
    }
  }
}

export default PaymentService;
