import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Patched version of TranscriptAPI using youtube-transcript package
 * This version uses a more reliable and maintained package for transcript fetching
 */
class PatchedTranscriptAPI {
  static async getTranscript(id, config = {}) {
    try {
      console.log('🎯 Fetching transcript using youtube-transcript package...');
      const transcript = await YoutubeTranscript.fetchTranscript(id);
      return transcript.map(entry => ({
        text: entry.text,
        start: entry.offset / 1000, // Convert ms to seconds
        duration: entry.duration
      }));
    } catch (error) {
      console.error('❌ Failed to fetch transcript:', error.message);
      throw new Error(error.message || 'Failed to fetch transcript');
    }
  }

  static async validateID(id) {
    try {
      // Try to fetch transcript - if it succeeds, video exists and has transcripts
      await YoutubeTranscript.fetchTranscript(id);
      return true;
    } catch (error) {
      console.warn('⚠️ Video validation failed:', error.message);
      // Return false only if video doesn't exist
      // If video exists but has no transcript, we'll handle that in getTranscript
      return !error.message.includes('Could not find the video') && 
             !error.message.includes('Video unavailable');
    }
  }
}

export default PatchedTranscriptAPI;
