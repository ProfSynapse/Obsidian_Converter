// src/imageProcessor.js
import sharp from 'sharp';
import { callVisionModel } from './llm.js';

export async function processImage(filePath) {
  try {
    const imageBuffer = await sharp(filePath).toBuffer();
    const base64Image = imageBuffer.toString('base64');
    const altText = await callVisionModel(base64Image);
    
    // Add alt text to image metadata or create a sidecar file
    await sharp(filePath)
      .withMetadata({ iptc: { 'Alt Text': altText } })
      .toFile(`${filePath}_with_alt.jpg`);

    console.log(`Processed image: ${filePath}`);
    return altText;
  } catch (error) {
    console.error(`Error processing image ${filePath}:`, error);
    throw error;
  }
}