/**
 * Icon Generator Script for Bingo PWA
 * Run with: node generate-icons.js
 * Requirements: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes required for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 167, 180, 192, 256, 512];

// Source SVG template
const SVG_TEMPLATE = fs.readFileSync('icon-template.svg', 'utf8');

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'icons');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Generate icons for each size
async function generateIcons() {
    console.log('🎨 Generating PWA icons...\n');

    for (const size of ICON_SIZES) {
        const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
        
        try {
            await sharp(Buffer.from(SVG_TEMPLATE))
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 10, g: 15, b: 30, alpha: 1 }
                })
                .png()
                .toFile(outputPath);
            
            console.log(`✅ Generated ${size}x${size} icon`);
        } catch (error) {
            console.error(`❌ Failed to generate ${size}x${size} icon:`, error.message);
        }
    }

    console.log('\n✨ Icon generation complete!');
    console.log(`📁 Icons saved to: ${OUTPUT_DIR}`);
}

// Generate maskable icons (with padding for safe area)
async function generateMaskableIcons() {
    console.log('\n🎨 Generating maskable icons...\n');

    for (const size of ICON_SIZES) {
        const outputPath = path.join(OUTPUT_DIR, `maskable-icon-${size}.png`);
        
        try {
            // Create a slightly smaller version for maskable (80% of size with padding)
            const maskableSize = Math.floor(size * 0.8);
            const padding = Math.floor(size * 0.1);
            
            await sharp(Buffer.from(SVG_TEMPLATE))
                .resize(maskableSize, maskableSize, {
                    fit: 'contain',
                    background: { r: 10, g: 15, b: 30, alpha: 1 }
                })
                .extend({
                    top: padding,
                    bottom: padding,
                    left: padding,
                    right: padding,
                    background: { r: 10, g: 15, b: 30, alpha: 1 }
                })
                .png()
                .toFile(outputPath);
            
            console.log(`✅ Generated maskable ${size}x${size} icon`);
        } catch (error) {
            console.error(`❌ Failed to generate maskable ${size}x${size} icon:`, error.message);
        }
    }
}

// Generate favicon.ico (multi-size)
async function generateFavicon() {
    const faviconPath = path.join(__dirname, 'favicon.ico');
    const faviconSizes = [16, 32, 48, 64];
    
    try {
        // Create a buffer array for multiple sizes
        const iconBuffers = await Promise.all(
            faviconSizes.map(async (size) => {
                return await sharp(Buffer.from(SVG_TEMPLATE))
                    .resize(size, size)
                    .png()
                    .toBuffer();
            })
        );
        
        // Note: This requires additional library for proper ICO generation
        // For simplicity, we'll just use the 32x32 version as favicon
        await sharp(Buffer.from(SVG_TEMPLATE))
            .resize(32, 32)
            .png()
            .toFile(path.join(__dirname, 'favicon.png'));
        
        console.log('✅ Generated favicon (PNG version)');
    } catch (error) {
        console.error('❌ Failed to generate favicon:', error.message);
    }
}

// Generate Apple touch icons
async function generateAppleIcons() {
    const appleSizes = [152, 167, 180];
    
    console.log('\n🍎 Generating Apple touch icons...\n');
    
    for (const size of appleSizes) {
        const outputPath = path.join(OUTPUT_DIR, `apple-touch-icon-${size}.png`);
        
        try {
            await sharp(Buffer.from(SVG_TEMPLATE))
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 10, g: 15, b: 30, alpha: 1 }
                })
                .png()
                .toFile(outputPath);
            
            console.log(`✅ Generated Apple icon ${size}x${size}`);
        } catch (error) {
            console.error(`❌ Failed to generate Apple icon ${size}x${size}:`, error.message);
        }
    }
}

// Generate splash screen images (for iOS)
async function generateSplashScreens() {
    const splashSizes = [
        { width: 2048, height: 2732, name: 'splash-ipad-pro' },
        { width: 1668, height: 2388, name: 'splash-ipad-pro-11' },
        { width: 1536, height: 2048, name: 'splash-ipad' },
        { width: 1125, height: 2436, name: 'splash-iphone-x' },
        { width: 1242, height: 2688, name: 'splash-iphone-x-max' },
        { width: 828, height: 1792, name: 'splash-iphone-xr' },
        { width: 750, height: 1334, name: 'splash-iphone-8' },
        { width: 1242, height: 2208, name: 'splash-iphone-8-plus' }
    ];
    
    console.log('\n📱 Generating splash screens...\n');
    
    for (const splash of splashSizes) {
        const outputPath = path.join(OUTPUT_DIR, `${splash.name}.png`);
        
        try {
            // Create a gradient background
            const gradientBackground = `
                <svg width="${splash.width}" height="${splash.height}">
                    <defs>
                        <linearGradient id="splashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#0a0f1e;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#1e2a3a;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#splashGradient)"/>
                    <g transform="translate(${splash.width/2}, ${splash.height/2})">
                        <text text-anchor="middle" fill="#fbbf24" font-size="${splash.width/15}" font-family="Times New Roman">መርከብ ቢንጎ</text>
                        <text text-anchor="middle" y="${splash.width/10}" fill="white" font-size="${splash.width/20}" font-family="Times New Roman">Loading...</text>
                    </g>
                </svg>
            `;
            
            await sharp(Buffer.from(gradientBackground))
                .png()
                .toFile(outputPath);
            
            console.log(`✅ Generated splash screen: ${splash.name} (${splash.width}x${splash.height})`);
        } catch (error) {
            console.error(`❌ Failed to generate splash screen ${splash.name}:`, error.message);
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Bingo PWA Icon Generator\n');
    console.log('===============================\n');
    
    await generateIcons();
    await generateMaskableIcons();
    await generateAppleIcons();
    await generateFavicon();
    await generateSplashScreens();
    
    console.log('\n✨ All icons generated successfully!');
    console.log('📁 Check the /icons directory for all assets\n');
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateIcons, generateMaskableIcons, generateAppleIcons, generateFavicon, generateSplashScreens };