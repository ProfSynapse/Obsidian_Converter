import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const convertFiles = async (apiKey, files, urls, outputFormat, onProgress) => {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append(`file${index}`, file);
  });
  formData.append('urls', JSON.stringify(urls));
  formData.append('outputFormat', outputFormat);

  try {
    const response = await axios.post(`${API_URL}/convert`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-API-Key': apiKey,
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      },
    });

    // Assuming the server responds with an array of converted file data
    return response.data.convertedFiles;
  } catch (error) {
    console.error('Error during conversion:', error);
    throw error;
  }
};