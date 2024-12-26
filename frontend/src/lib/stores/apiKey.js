// src/lib/stores/apiKey.js

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Initialize from localStorage if available
const storedApiKey = browser ? localStorage.getItem('obsdian_note_converter_api_key') : null;

// Create the store
const apiKey = writable(storedApiKey || '');

// Subscribe to changes and update localStorage
if (browser) {
    apiKey.subscribe(value => {
        if (value) {
            localStorage.setItem('obsdian_note_converter_api_key', value);
        } else {
            localStorage.removeItem('obsdian_note_converter_api_key');
        }
    });
}

export { apiKey };
