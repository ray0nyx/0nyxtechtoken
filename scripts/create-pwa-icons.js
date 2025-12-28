import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create placeholder icons
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
        console.log(`Created icon-${size}x${size}.png from favicon`);
      } else {
        // If favicon doesn't exist, create an empty file
        fs.writeFileSync(filePath, '');
        console.log(`Created empty placeholder for icon-${size}x${size}.png`);
      }
    }
  }
  
  console.log('All icon placeholders created successfully!');
}

createPlaceholderIcons(); 