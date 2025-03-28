import { writable } from 'svelte/store';

function createPaymentStore() {
    const { subscribe, set, update } = writable({
        amount: 0,
        status: 'pending', // 'pending', 'processing', 'completed', 'failed', 'skipped'
        showPaymentPrompt: false,
        error: null,
        clientSecret: null
    });

    return {
        subscribe,
        setAmount: (amount) => update(store => ({ ...store, amount })),
        setStatus: (status) => update(store => ({ ...store, status })),
        setError: (error) => update(store => ({ ...store, error })),
        setClientSecret: (secret) => update(store => ({ ...store, clientSecret: secret })),
        showPrompt: () => update(store => ({ ...store, showPaymentPrompt: true })),
        hidePrompt: () => update(store => ({ ...store, showPaymentPrompt: false })),
        startProcessing: () => update(store => ({ ...store, status: 'processing', error: null })),
        reset: () => set({
            amount: 0,
            status: 'pending',
            showPaymentPrompt: false,
            error: null,
            clientSecret: null
        })
    };
}

export const paymentStore = createPaymentStore();
