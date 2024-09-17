// scraper.js
import { YoutubeTranscript } from 'youtube-transcript';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeYouTubeTranscript(url) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    return transcript.map(item => item.text).join('\n');
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error.message);
    return `Error: Unable to fetch YouTube transcript. ${error.message}`;
  }
}

export async function scrapeWebsiteText(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Extract the main content
    const content = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.getElementsByTagName('script');
      const styles = document.getElementsByTagName('style');
      Array.from(scripts).forEach(script => script.remove());
      Array.from(styles).forEach(style => style.remove());

      // Get the main content
      const main = document.querySelector('main') || document.querySelector('article') || document.body;

      // Extract text from paragraphs and headings
      const textElements = main.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      return Array.from(textElements)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0)
        .join('\n\n');
    });

    return content;
  } catch (error) {
    console.error('Error scraping website text:', error);
    return `Error: Unable to scrape website text. ${error.message}`;
  } finally {
    if (browser) await browser.close();
  }
}