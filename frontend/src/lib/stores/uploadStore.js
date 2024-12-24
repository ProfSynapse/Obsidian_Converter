// src/lib/components/stores/uploadStore.js
import { writable } from 'svelte/store';

function createUploadStore() {
  const { subscribe, update, set } = writable({
    activeTab: 'single',
    dragOver: false,
    urlInput: '',
    youtubeUrlInput: '',
    errorMessage: '',
    message: '',
    messageType: '',
    feedbackTimeout: null
  });

  return {
    subscribe,
    setActiveTab: (tab) => update(state => ({ ...state, activeTab: tab })),
    setDragOver: (value) => update(state => ({ ...state, dragOver: value })),
    setUrlInput: (value) => update(state => ({ ...state, urlInput: value })),
    setYoutubeInput: (value) => update(state => ({ ...state, youtubeUrlInput: value })),
    setError: (message) => update(state => ({ ...state, errorMessage: message })),
    clearError: () => update(state => ({ ...state, errorMessage: '' })),
    setMessage: (message, type = 'info') => update(state => ({ 
      ...state, 
      message,
      messageType: type 
    })),
    clearMessage: () => update(state => ({ 
      ...state, 
      message: '',
      messageType: '' 
    })),
    reset: () => set({
      activeTab: 'single',
      dragOver: false,
      urlInput: '',
      youtubeUrlInput: '',
      errorMessage: '',
      message: '',
      messageType: '',
      feedbackTimeout: null
    })
  };
}

export const uploadStore = createUploadStore();