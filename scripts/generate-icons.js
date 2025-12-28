import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [
  16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512
];

// OpenGraph image size
const ogSize = {
  width: 1200,
  height: 630
};

async function generateIcons() {
  const sourceIcon = path.join(__dirname, '../public/icons/icon-512x512.png');
  
  try {
    await fs.access(sourceIcon);
  } catch (err) {
    console.error('Source icon not found:', sourceIcon);
    process.exit(1);
  }

  // Create icons directory if it doesn't exist
  const iconsDir = path.join(__dirname, '../public/icons');
  try {
    await fs.mkdir(iconsDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }

  // Generate square icons
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    try {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`Generated ${size}x${size} icon`);
    } catch (err) {
      console.error(`Error generating ${size}x${size} icon:`, err);
    }
  }

  // Generate OpenGraph image
  try {
    const ogOutputPath = path.join(iconsDir, 'og-image.png');
    await sharp(sourceIcon)
      .resize(ogSize.width, ogSize.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .composite([
        {
          input: Buffer.from(`
            <svg width="${ogSize.width}" height="${ogSize.height}">
              <style>
                .title { font: bold 60px sans-serif; fill: white; }
                .subtitle { font: 40px sans-serif; fill: #E91E63; }
              </style>
              <text x="50%" y="40%" text-anchor="middle" class="title">WagYu Trading Journal</text>
              <text x="50%" y="55%" text-anchor="middle" class="subtitle">Professional Trading Analytics Platform</text>
            </svg>`),
          top: 0,
          left: 0,
        }
      ])
      .png()
      .toFile(ogOutputPath);
    console.log('Generated OpenGraph image');
  } catch (err) {
    console.error('Error generating OpenGraph image:', err);
  }

  // Generate favicon.ico (multi-size)
  try {
    const faviconPath = path.join(__dirname, '../public/favicon.ico');
    const faviconSizes = [16, 32, 48];
    const faviconBuffers = await Promise.all(
      faviconSizes.map(size =>
        sharp(sourceIcon)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .toBuffer()
      )
    );
    
    await sharp(faviconBuffers[0])
      .toFile(faviconPath);
    console.log('Generated favicon.ico');
  } catch (err) {
    console.error('Error generating favicon.ico:', err);
  }
}

generateIcons().catch(console.error); 