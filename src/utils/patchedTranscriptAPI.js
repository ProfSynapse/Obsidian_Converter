import axios from "axios";
import * as cheerio from "cheerio";  // Fixed import statement for cheerio

/**
 * Patched version of TranscriptAPI that properly imports cheerio
 * This fixes the ESM compatibility issue with the original youtube-transcript-api
 */
class PatchedTranscriptAPI {
  static async getTranscript(id, config = {}) {
    const url = new URL('https://youtubetranscript.com');
    url.searchParams.set('server_vid2', id);
    
    const response = await axios.get(url, config);
    const $ = cheerio.load(response.data, undefined, false);
    const err = $('error');
  
    if (err.length) throw new Error(err.text());
    return $('transcript text').map((i, elem) => {
      const $a = $(elem);
      return {
        text: $a.text(),
        start: Number($a.attr('start')),
        duration: Number($a.attr('dur'))
      };
    }).toArray();
  }

  static async validateID(id, config = {}) {
    const url = new URL('https://video.google.com/timedtext');
    url.searchParams.set('type', 'track');
    url.searchParams.set('v', id);
    url.searchParams.set('id', 0);
    url.searchParams.set('lang', 'en');
    
    try {
      await axios.get(url, config);
      return true;
    } catch (_) {
      return false;
    }
  }
}

export default PatchedTranscriptAPI;
