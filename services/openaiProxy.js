// services/openaiProxy.js

import OpenAI from 'openai';
import { createRequire } from 'module'; // Import createRequire
const require = createRequire(import.meta.url); // Create a require function
const { RateLimiter } = require('limiter'); // Destructure RateLimiter from the required package
import fs from 'fs';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config/default.js';
import NodeCache from 'node-cache';
import { AppError } from '../utils/errorHandler.js';

class OpenAIProxy {
  constructor() {
    this.openai = null;
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: config.api.openai.maxRequests || 50,
      interval: 'minute',
    });
    this.cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes
  }

  async initialize(apiKey) {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: config.api.openai.baseUrl,
        timeout: config.api.openai.timeout,
      });

      // Configure axios retry
      axiosRetry(this.openai.httpClient, {
        retries: config.api.openai.maxRetries,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error) => {
          return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error);
        },
      });
    }
  }

  async makeRequest(apiKey, endpoint, data) {
    await this.rateLimiter.removeTokens(1);
    await this.initialize(apiKey);

    const cacheKey = `${endpoint}:${JSON.stringify(data)}`;
    const cachedResponse = this.cache.get(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const response = await this.openai.httpClient.post(`/${endpoint}`, data, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(data.getHeaders ? data.getHeaders() : {}),
        },
      });

      this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      switch (status) {
        case 401:
          return new AppError('Invalid API key', 401);
        case 429:
          return new AppError('Rate limit exceeded', 429);
        case 500:
          return new AppError('OpenAI server error', 500);
        default:
          return new AppError(`Whisper API error: ${data.error.message}`, status);
      }
    }
    return new AppError('Unknown OpenAI API error', 500);
  }
}

export const openaiProxy = new OpenAIProxy();
