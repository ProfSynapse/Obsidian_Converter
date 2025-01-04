// src/lib/stores/files.js

import { writable, derived } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { requiresApiKey } from '$lib/utils/fileUtils.js';

// Create and export the stores
export const files = createFilesStore();
export const currentFileType = derived(files, $files => {
    const activeFile = $files[0];
    if (!activeFile) return null;
    return activeFile.name.split('.').pop().toLowerCase();
});

/**
 * File status enumeration
 */
export const FileStatus = {
    READY: 'ready',
    UPLOADING: 'uploading',
    CONVERTING: 'converting',
    COMPLETED: 'completed',
    ERROR: 'error'
};

/**
 * Utility functions for file operations
 */
const FileUtils = {
    /**
     * Creates a standardized result object
     */
    createResult(success, message, data = null) {
        return { success, message, file: data };
    },

    /**
     * Creates a standardized file object
     */
    createFileObject(file) {
        const extension = file.name?.split('.').pop()?.toLowerCase();
        return {
            id: uuidv4(),
            name: file.name,
            type: file.type || extension || 'unknown',  // Ensure type is set from extension if not provided
            size: file.size || 0,
            url: file.url || null,
            file: file.file || null,
            status: FileStatus.READY,
            progress: 0,
            error: null,
            selected: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            requiresApiKey: requiresApiKey(file),
            ...file  // Allow override but after setting defaults
        };
    },

    /**
     * Checks for duplicate files
     */
    isDuplicate(files, newFile) {
        return files.some(f => (
            (f.url && newFile.url && f.url === newFile.url) ||
            (f.name && newFile.name && f.name === newFile.name && f.type === newFile.type)
        ));
    },

    /**
     * Updates a file's timestamp
     */
    withTimestamp(file) {
        return {
            ...file,
            updatedAt: new Date().toISOString()
        };
    }
};

/**
 * Creates a store action with standard error handling
 */
function createAction(name, handler) {
    return (...args) => {
        try {
            return handler(...args);
        } catch (error) {
            console.error(`📁 Error in ${name}:`, error);
            return FileUtils.createResult(false, error.message);
        }
    };
}

/**
 * Creates and returns the files store
 */
function createFilesStore() {
    const { subscribe, update, set } = writable([]);

    function hasFile(url) {
        let found = false;
        update(files => {
            found = files.some(file => file.url === url);
            console.log('Checking if file exists with URL:', url, 'Found:', found);
            return files;
        });
        return found;
    }

    /**
     * Updates files and returns a result
     */
    function updateFiles(updater, successMsg) {
        let result;
        update(files => {
            const updated = updater(files);
            result = updated.result;
            console.log('Files updated:', updated.files);
            return updated.files;
        });
        return result;
    }

    return {
        subscribe,

        /**
         * Adds a file to the store
         */
        addFile: createAction('addFile', (file) => {
            const newFile = FileUtils.createFileObject(file);
            console.log('[filesStore] Attempting to add file:', newFile);
            
            return updateFiles(files => {
                if (FileUtils.isDuplicate(files, newFile)) {
                    console.log('[filesStore] Duplicate file detected:', newFile.name);
                    return {
                        files,
                        result: FileUtils.createResult(false, 
                            `File "${newFile.name}" already exists`
                        )
                    };
                }

                console.log('[filesStore] Adding file:', newFile);
                console.log('[filesStore] Current file count:', files.length);
                return {
                    files: [...files, newFile],
                    result: FileUtils.createResult(true, 
                        `Added "${newFile.name}" successfully`, 
                        newFile
                    )
                };
            });
        }),

        /**
         * Updates a file in the store
         */
        updateFile: createAction('updateFile', (id, data) => {
            console.log('[filesStore] Updating file with ID:', id, 'Data:', data);
            return updateFiles(files => {
                const index = files.findIndex(f => f.id === id);
                if (index === -1) {
                    console.log('[filesStore] File not found for update:', id);
                    return {
                        files,
                        result: FileUtils.createResult(false, 'File not found')
                    };
                }

                const updatedFile = FileUtils.withTimestamp({
                    ...files[index],
                    ...data
                });

                const updatedFiles = [...files];
                updatedFiles[index] = updatedFile;

                console.log('[filesStore] Updated file:', updatedFile);
                return {
                    files: updatedFiles,
                    result: FileUtils.createResult(true, 
                        'File updated successfully', 
                        updatedFile
                    )
                };
            });
        }),

        /**
         * Removes a file from the store
         */
        removeFile: createAction('removeFile', (id) => {
            console.log('[filesStore] Removing file with ID:', id);
            return updateFiles(files => {
                const fileToRemove = files.find(f => f.id === id);
                if (!fileToRemove) {
                    console.log('[filesStore] File not found for removal:', id);
                    return {
                        files,
                        result: FileUtils.createResult(false, 
                            `File with ID "${id}" not found`
                        )
                    };
                }

                console.log('[filesStore] Removing file:', fileToRemove);
                return {
                    files: files.filter(f => f.id !== id),
                    result: FileUtils.createResult(true, 
                        `Removed "${fileToRemove.name}" successfully`, 
                        fileToRemove
                    )
                };
            });
        }),

        /**
         * Selects or deselects a file
         */
        toggleSelect: createAction('toggleSelect', (id) => {
            console.log('[filesStore] Toggling selection for file ID:', id);
            return updateFiles(files => {
                const index = files.findIndex(f => f.id === id);
                if (index === -1) {
                    console.log('[filesStore] File not found for toggle:', id);
                    return {
                        files,
                        result: FileUtils.createResult(false, 'File not found')
                    };
                }

                const updatedFiles = [...files];
                updatedFiles[index] = FileUtils.withTimestamp({
                    ...files[index],
                    selected: !files[index].selected
                });

                console.log('[filesStore] Toggled selection for file:', updatedFiles[index]);
                return {
                    files: updatedFiles,
                    result: FileUtils.createResult(true, 
                        'Selection toggled successfully', 
                        updatedFiles[index]
                    )
                };
            });
        }),

        /**
         * Selects or deselects all files
         */
        selectAll: createAction('selectAll', (select = true) => {
            console.log('[filesStore] Selecting all files:', select);
            let count = 0;
            return updateFiles(files => {
                const updatedFiles = files.map(file => {
                    if (file.selected !== select) {
                        count++;
                        return FileUtils.withTimestamp({
                            ...file,
                            selected: select
                        });
                    }
                    return file;
                });

                console.log('[filesStore] Selected/Deselected', count, 'files');
                return {
                    files: updatedFiles,
                    result: {
                        success: true,
                        message: `${select ? 'Selected' : 'Deselected'} ${count} files`,
                        count
                    }
                };
            });
        }),

        /**
         * Retrieves currently selected files
         */
        getSelectedFiles() {
            console.log('[filesStore] Retrieving selected files');
            let selected = [];
            update(files => {
                selected = files.filter(f => f.selected);
                console.log('[filesStore] Selected files:', selected);
                return files;
            });
            return selected;
        },

        /**
         * Clears all files from the store
         */
        clearFiles: createAction('clearFiles', () => {
            console.log('[filesStore] Clearing all files');
            let count = 0;
            return updateFiles(files => {
                count = files.length;
                console.log('[filesStore] Clearing', count, 'files');
                return {
                    files: [],
                    result: {
                        success: true,
                        message: `Cleared ${count} files`,
                        count
                    }
                };
            });
        })
    };
}