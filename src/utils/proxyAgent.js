// utils/proxyAgent.js
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';

/**
 * Creates a SOCKS proxy agent for Tor connections
 * @returns {SocksProxyAgent} Configured SOCKS proxy agent
 */
export function createTorProxyAgent() {
  const host = process.env.TOR_PROXY_HOST || 'localhost';
  const port = process.env.TOR_SOCKS_PORT || 9050;
  
  return new SocksProxyAgent(`socks5://${host}:${port}`);
}

/**
 * Creates an HTTPS agent with Tor proxy configuration
 * @returns {Object} Object containing both the agent and a request wrapper
 */
export function configureTorProxy() {
  const agent = createTorProxyAgent();

  // Wrapper for making proxy requests
  const makeProxiedRequest = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        ...options,
        agent,
      };

      https.get(url, requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ data, response: res });
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  };

  return {
    agent,
    makeProxiedRequest,
  };
}

/**
 * Attempts to make a request through Tor with retry logic
 * @param {Function} requestFn - The request function to execute
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise} Result of the request
 */
export async function withTorRetry(requestFn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      console.error(`🔄 Tor request attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
