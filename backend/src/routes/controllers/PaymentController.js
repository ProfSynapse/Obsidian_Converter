import { validationResult } from 'express-validator';
import PaymentService from '../../services/PaymentService.js';

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Creates a payment intent for a donation
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async createPaymentIntent(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            message: errors.array()[0].msg || 'Invalid request parameters'
          }
        });
      }

      const amount = parseInt(req.body.amount || '0', 10);
      
      const paymentIntent = await this.paymentService.createPaymentIntent(amount);
      
      res.json(paymentIntent);
    } catch (error) {
      console.error('❌ Payment controller error:', error);
      res.status(500).json({
        error: {
          message: error.message || 'Error creating payment intent'
        }
      });
    }
  }
}

export default PaymentController;
