const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

// Find the appropriate Logo source file (prefer Logo.jpeg as requested)
let sourcePath = path.join(publicDir, 'Logo.jpeg');
if (!fs.existsSync(sourcePath)) {
  sourcePath = path.join(publicDir, 'logo.jpeg');
}
if (!fs.existsSync(sourcePath)) {
  sourcePath = path.join(publicDir, 'logo.svg');
}

async function generate() {
  try {
    console.log(`Generating PWA icons from source: ${sourcePath}...`);
    
    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found at ${sourcePath}`);
    }

    // Generate 192x192 icon
    await sharp(sourcePath)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    console.log('Created icon-192x192.png');

    // Generate 512x512 icon
    await sharp(sourcePath)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    console.log('Created icon-512x512.png');

    // Generate apple-touch-icon (180x180)
    await sharp(sourcePath)
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
