<!-- src/lib/components/common/UrlInput.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { uploadStore } from '../../stores/uploadStore.js';
    import { files } from '../../stores/files.js';

    const dispatch = createEventDispatcher();

    // State
    let inputValue = '';
    let errorMessage = '';
    let loading = false;

    // URL type configurations
    const URL_TYPES = {
        youtube: {
            icon: '🎥',
            placeholder: 'Enter YouTube URL to convert',
            description: 'Convert YouTube video to Markdown notes',
            type: 'youtube'
        },
        parent: {
            icon: '🗺️',
            placeholder: 'Enter Parent URL to convert',
            description: 'Convert all pages linked from this URL',
            type: 'parent'
        },
        single: {
            icon: '🔗',
            placeholder: 'Enter URL to convert',
            description: 'Convert single webpage to Markdown',
            type: 'url'
        }
    };

    // Reactive declarations
    $: activeType = $uploadStore.activeTab;
    $: currentConfig = URL_TYPES[activeType] || URL_TYPES.single;
    $: isValidFormat = inputValue && couldBeValidUrl(inputValue);

    /**
     * Basic URL validation function
     */
    function couldBeValidUrl(input) {
        try {
            const trimmed = input.trim();
            // Check for basic URL pattern
            return /^(https?:\/\/)?([\w-]+(\.[\w-]+)+|localhost)(:\d+)?(\/\S*)?$/.test(trimmed);
        } catch (error) {
            return false;
        }
    }

    /**
     * URL normalization function
     */
    function normalizeUrl(input) {
        if (!input) throw new Error('URL is required');
        
        let url = input.trim().replace(/\s+/g, '');
        
        // Add https:// if no protocol specified
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        
        try {
            // Check if URL is valid
            new URL(url);
            return url;
        } catch (error) {
            throw new Error('Invalid URL format');
        }
    }

    /**
     * Handles input changes and updates store
     */
    function handleInput(event) {
        const value = event.target.value;
        inputValue = value;
        
        if (activeType === 'youtube') {
            uploadStore.setYoutubeInput(value);
        } else {
            uploadStore.setUrlInput(value);
        }
        
        errorMessage = '';
    }

    /**
     * Adds URL to conversion queue
     */
    async function handleSubmit() {
        try {
            if (!inputValue.trim()) {
                throw new Error('Please enter a URL');
            }

            // Normalize URL
            const normalizedUrl = normalizeUrl(inputValue);

            // Create file object
            const urlObj = new URL(normalizedUrl);
            const fileObj = {
                url: normalizedUrl,
                name: `${urlObj.hostname}${urlObj.pathname}`,
                type: currentConfig.type
            };

            // Validate based on type
            if (currentConfig.type === 'youtube') {
                const youtubeRegex = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
                if (!youtubeRegex.test(normalizedUrl)) {
                    throw new Error('Invalid YouTube URL format');
                }
            }

            // Add to files store
            const result = files.addFile(fileObj);

            if (result.success) {
                inputValue = '';
                if (activeType === 'youtube') {
                    uploadStore.setYoutubeInput('');
                } else {
                    uploadStore.setUrlInput('');
                }
                dispatch('submitUrl', { 
                    url: normalizedUrl, 
                    type: currentConfig.type 
                });
            } else {
                errorMessage = result.message;
            }

        } catch (error) {
            console.error('URL submission error:', error);
            errorMessage = error.message;
        }
    }

    /**
     * Handles keyboard submission
     */
    function handleKeyPress(event) {
        if (event.key === 'Enter' && isValidFormat) {
            handleSubmit();
        }
    }
</script>

<div class="url-input-section" in:fade={{ duration: 200 }}>
    <!-- Input Container -->
    <div class="input-container">
        <!-- Type Icon -->
        <div class="input-icon" aria-hidden="true">
            {currentConfig.icon}
        </div>

        <!-- URL Input -->
        <input
            type="text"
            class="url-input"
            placeholder={currentConfig.placeholder}
            bind:value={inputValue}
            on:input={handleInput}
            on:keypress={handleKeyPress}
            disabled={loading}
            aria-label={currentConfig.placeholder}
            aria-describedby="url-error url-description"
        />

        <!-- Submit Button -->
        <button 
            class="submit-button"
            on:click={handleSubmit}
            disabled={!isValidFormat || loading}
            aria-label="Add URL to queue"
        >
            <span class="icon">➕</span>
        </button>
    </div>

    <!-- Error Message -->
    {#if errorMessage}
        <div 
            id="url-error" 
            class="error-message" 
            role="alert"
            in:fade={{ duration: 200 }}
        >
            {errorMessage}
        </div>
    {/if}

    <!-- Format Warning -->
    {#if inputValue && !isValidFormat && !errorMessage}
        <div 
            id="url-format-warning" 
            class="error-message" 
            role="alert"
            in:fade={{ duration: 200 }}
        >
            The URL format looks incorrect.
        </div>
    {/if}

    <!-- URL Type Description -->
    <div 
        id="url-description"
        class="url-type-indicator" 
        in:fly={{ y: 10, duration: 200 }}
    >
        {currentConfig.description}
    </div>
</div>

<style>
    .url-input-section {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
        width: 100%;
        max-width: 800px; /* Increased from 600px to match container */
        margin: 0 auto;
    }

    .input-container {
        display: flex;
        align-items: center;
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-radius: var(--rounded-lg);
        padding: var(--spacing-xs);
        transition: all var(--transition-duration-normal) var(--transition-timing-ease);
    }

    .input-container:focus-within {
        border-color: var(--color-prime);
        box-shadow: var(--shadow-sm);
    }

    .input-icon {
        padding: var(--spacing-xs) var(--spacing-sm);
        font-size: var(--font-size-lg);
        opacity: 0.8;
    }

    .url-input {
        flex: 1;
        border: none;
        background: transparent;
        padding: var(--spacing-sm);
        font-size: var(--font-size-base);
        color: var(--color-text);
        min-width: 0;
    }

    .url-input:focus {
        outline: none;
    }

    .url-input:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    .submit-button {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-prime);
        color: var(--color-text-on-dark);
        border: none;
        border-radius: var(--rounded-md);
        width: 36px;
        height: 36px;
        cursor: pointer;
        transition: all var(--transition-duration-normal) var(--transition-timing-ease);
    }

    .submit-button:hover:not(:disabled) {
        transform: scale(1.05);
        background: var(--color-second);
    }

    .submit-button:disabled {
        background: var(--color-disabled);
        cursor: not-allowed;
        transform: none;
    }

    .error-message {
        color: var(--color-error);
        font-size: var(--font-size-sm);
        margin-top: var(--spacing-xs);
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-error-light);
        border-radius: var(--rounded-md);
    }

    .url-type-indicator {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        padding: var(--spacing-2xs) var(--spacing-md);
        margin-bottom: var(--spacing-xs);
    }

    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
        .input-container {
            background: var(--color-background);
        }

        .url-input {
            color: var(--color-text-on-dark);
        }
    }

    /* Mobile Responsiveness */
    @media (max-width: 640px) {
        .url-input {
            font-size: var(--font-size-sm);
        }

        .submit-button {
            width: 32px;
            height: 32px;
            font-size: var(--font-size-sm);
        }

        .input-icon {
            font-size: var(--font-size-base);
        }
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
        .input-container,
        .submit-button {
            transition: none;
        }

        .submit-button:hover:not(:disabled) {
            transform: none;
        }
    }

    /* High Contrast */
    @media (prefers-contrast: high) {
        .input-container {
            border-width: 3px;
        }

        .submit-button {
            outline: 2px solid currentColor;
        }
    }
</style>