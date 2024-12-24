// src/lib/stores/apiKey.js

import { writable } from 'svelte/store';

/**
 * Creates and returns an API key store
 * @returns {Object} - The API key store with methods
 */
function createApiKeyStore() {
  const { subscribe, set } = writable('');

  return {
    subscribe,
    /**
     * Sets the API key and stores it in localStorage
     * @param {string} apiKey - The API key string
     */
    set: (apiKey) => {
      set(apiKey);
      if (typeof window !== 'undefined') {
        localStorage.setItem('apiKey', apiKey);
      }
    },
    /**
     * Clears the API key and removes it from localStorage
     */
    clear: () => {
      set('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('apiKey');
      }
    },
    /**
     * Initializes the store from localStorage if available
     */
    init: () => {
      if (typeof window !== 'undefined') {
        const storedApiKey = localStorage.getItem('apiKey');
        if (storedApiKey) {
          set(storedApiKey);
        }
      }
    }
  };
}

export const apiKey = createApiKeyStore();
