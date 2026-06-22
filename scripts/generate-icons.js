const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/logo.svg');
const publicDir = path.join(__dirname, '../public');

async function generate() {
  try {
    console.log('Generating PWA icons from logo.svg...');
    
    // Check if logo.svg exists
    if (!fs.existsSync(svgPath)) {
      throw new Error(`SVG file not found at ${svgPath}`);
    }

    // Generate 192x192 icon
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    console.log('Created icon-192x192.png');

    // Generate 512x512 icon
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    console.log('Created icon-512x512.png');

    // Generate apple-touch-icon (180x180)
    await sharp(svgPath)
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('Created apple-touch-icon.png');

    console.log('PWA icons generated successfully!');
  } catch (err) {
    console.error('Error generating PWA icons:', err);
    process.exit(1);
  }
}

generate();
