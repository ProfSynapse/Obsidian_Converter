import fs from 'fs';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function transcribeAudio(filePath) {
  try {
    console.log('API Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
    console.log('Transcribing file:', filePath);
    
    const fileStream = fs.createReadStream(filePath);
    console.log('File stream created');

    const response = await openai.createTranscription(
      fileStream,
      "whisper-1"
    );
    console.log('Transcription API call successful');
    return response.data.text;
  } catch (error) {
    console.error('Error transcribing audio:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}