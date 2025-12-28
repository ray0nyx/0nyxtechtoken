import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Colors
const bgColor = '#000000';
const fgColor = '#E91E63'; // Magenta color

async function generateIcons() {
  try {
    // Create icons directory if it doesn't exist
    const iconsDir = path.join(__dirname, '../public/icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Generate icons for each size
    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Draw a circle with the brand color
      ctx.fillStyle = fgColor;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Draw text
      const fontSize = Math.floor(size * 0.3);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WY', size / 2, size / 2);

      // Save the icon
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), buffer);
      console.log(`Generated icon-${size}x${size}.png`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

// If canvas package is not available, create simple placeholder files
function createPlaceholderIcons() {
  const iconsDir = path.join(__dirname, '../public/icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const size of sizes) {
    // Create an empty file for each icon size
    const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
    if (!fs.existsSync(filePath)) {
      // Copy the favicon.ico to each icon file as a placeholder
      const faviconPath = path.join(__dirname, '../public/favicon.ico');
      if (fs.existsSync(faviconPath)) {
        fs.copyFileSync(faviconPath, filePath);
      } else {
        // If favicon doesn't exist, create an empty file
        fs.writeFileSync(filePath, '');
      }
      console.log(`Created placeholder for icon-${size}x${size}.png`);
    }
  }
}

// Try to generate icons, fall back to placeholders if canvas is not available
try {
  if (typeof createCanvas === 'function') {
    generateIcons();
  } else {
    console.warn('Canvas package not available, creating placeholder icons');
    createPlaceholderIcons();
  }
} catch (error) {
  console.warn('Error loading canvas, creating placeholder icons:', error);
  createPlaceholderIcons();
} 