// services/converter/text/pdfConverter.js
import pdfjs from '@bundled-es-modules/pdfjs-dist/build/pdf.js';
import path from 'path';
import tmp from 'tmp-promise';
import fs from 'fs/promises';
import pdf from 'pdf-parse';

// Set worker source using CDN
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export async function convertPdfToMarkdown(input, originalName) {
  let tempDir;
  try {
    tempDir = await tmp.dir({ unsafeCleanup: true });
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: input });
    const pdfDoc = await loadingTask.promise;
    
    // Extract text content using pdf-parse (for better text handling)
    const data = await pdf(input);
    let markdown = `# ${path.basename(originalName, '.pdf')}\n\n`;
    
    const allImages = [];
    
    // Process each page
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Create canvas for the full page
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        
        // First pass: Render the full page
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Second pass: Get text content with positions
        const textContent = await page.getTextContent();
        
        // Create a mask canvas
        const maskCanvas = createCanvas(viewport.width, viewport.height);
        const maskContext = maskCanvas.getContext('2d');
        maskContext.fillStyle = 'white';
        maskContext.fillRect(0, 0, viewport.width, viewport.height);
        
        // Draw black rectangles for text areas
        maskContext.fillStyle = 'black';
        textContent.items.forEach(item => {
          const tx = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
          );
          maskContext.fillRect(
            tx[4],
            viewport.height - tx[5] - item.height,
            item.width,
            item.height
          );
        });
        
        // Find connected components (non-text areas)
        const imageRegions = findNonTextRegions(maskCanvas);
        
        // Extract each region as an image
        imageRegions.forEach((region, idx) => {
          const { x, y, width, height } = region;
          
          // Create canvas for this region
          const regionCanvas = createCanvas(width, height);
          const regionContext = regionCanvas.getContext('2d');
          
          // Copy region from original canvas
          regionContext.drawImage(
            canvas,
            x, y, width, height,
            0, 0, width, height
          );
          
          // Convert to PNG buffer
          const imageBuffer = regionCanvas.toBuffer('image/png');
          const fileName = `page${pageNum}_region${idx + 1}.png`;
          
          // Save image
          allImages.push({
            name: fileName,
            data: imageBuffer.toString('base64'),
            width: width,
            height: height,
            path: `attachments/${path.basename(originalName, '.pdf')}/${fileName}`
          });
          
          // Add to markdown
          markdown += `![Region ${idx + 1} from page ${pageNum}](attachments/${path.basename(originalName, '.pdf')}/${fileName})\n\n`;
        });
        
        // Add text content
        const pageContent = data.text.split('\f')[pageNum - 1];
        if (pageContent?.trim()) {
          markdown += `${pageContent.trim()}\n\n`;
        }
        
      } catch (error) {
        console.warn(`Error processing page ${pageNum}:`, error);
      }
    }
    
    return {
      content: markdown.trim(),
      images: allImages
    };
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw error;
  } finally {
    if (tempDir) {
      await tempDir.cleanup().catch(console.error);
    }
  }
}

function createCanvas(width, height) {
  // If running in Node.js
  if (typeof window === 'undefined') {
    const { createCanvas } = require('canvas');
    return createCanvas(width, height);
  }
  // If running in browser
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function findNonTextRegions(maskCanvas) {
  const ctx = maskCanvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imageData.data;
  
  // Find connected white components (non-text areas)
  const regions = [];
  const visited = new Set();
  
  for (let y = 0; y < maskCanvas.height; y++) {
    for (let x = 0; x < maskCanvas.width; x++) {
      const idx = (y * maskCanvas.width + x) * 4;
      
      // If white pixel and not visited
      if (data[idx] === 255 && !visited.has(`${x},${y}`)) {
        const region = floodFill(x, y, data, maskCanvas.width, maskCanvas.height, visited);
        if (region.width > 10 && region.height > 10) { // Minimum size threshold
          regions.push(region);
        }
      }
    }
  }
  
  return regions;
}

function floodFill(startX, startY, data, width, height, visited) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    const idx = (y * width + x) * 4;
    if (data[idx] !== 255) continue;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Check neighbors
    [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dy]) => {
      const newX = x + dx;
      const newY = y + dy;
      
      if (newX >= 0 && newX < width && 
          newY >= 0 && newY < height && 
          !visited.has(`${newX},${newY}`)) {
        stack.push([newX, newY]);
      }
    });
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}