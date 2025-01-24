import express from 'express';
import { body } from 'express-validator';
import PaymentController from './controllers/PaymentController.js';

const router = express.Router();
const paymentController = new PaymentController();

// Create payment intent
router.post(
  '/create-intent',
  [
    body('amount')
      .isInt()
      .withMessage('Amount must be provided in cents')
      .notEmpty()
      .withMessage('Amount is required')
  ],
  (req, res) => paymentController.createPaymentIntent(req, res)
);

export default router;
