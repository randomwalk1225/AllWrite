const toIco = require('to-ico');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create build directory if it doesn't exist
if (!fs.existsSync('build')) {
  fs.mkdirSync('build');
}

async function convertIcon() {
  try {
    const inputPath = path.join(__dirname, 'img', 'icon.png');
    const outputIcoPath = path.join(__dirname, 'build', 'icon.ico');
    const outputPngPath = path.join(__dirname, 'build', 'icon.png');

    // Resize to 512x512 for electron-builder
    const resizedBuffer = await sharp(inputPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Save 512x512 PNG
    fs.writeFileSync(outputPngPath, resizedBuffer);
    console.log('✓ Created build/icon.png (512x512)');

    // Create ICO with multiple sizes
    const buf = await toIco([resizedBuffer], {
      sizes: [16, 24, 32, 48, 64, 128, 256],
      resize: true
    });

    fs.writeFileSync(outputIcoPath, buf);
    console.log('✓ Created build/icon.ico (multi-size)');
  } catch (err) {
    console.error('Error converting icon:', err);
    process.exit(1);
  }
}

convertIcon();
