#!/bin/bash

# Bingo PWA Icon Generator Script
# Run: chmod +x generate-icons.sh && ./generate-icons.sh

echo "🎨 Bingo PWA Icon Generator"
echo "==========================="
echo ""

# Create icons directory if it doesn't exist
mkdir -p icons

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed."
    echo "📦 Install with: brew install imagemagick (macOS)"
    echo "📦 Or: sudo apt-get install imagemagick (Linux)"
    exit 1
fi

# Check if SVG file exists
if [ ! -f "icon-template.svg" ]; then
    echo "❌ icon-template.svg not found!"
    exit 1
fi

# Icon sizes array
SIZES=(72 96 128 144 152 167 180 192 256 512)

echo "📱 Generating standard PWA icons..."
for size in "${SIZES[@]}"; do
    convert -background none -resize ${size}x${size} icon-template.svg icons/icon-${size}.png
    echo "  ✅ Generated ${size}x${size}"
done

echo ""
echo "🎭 Generating maskable icons..."
for size in "${SIZES[@]}"; do
    # Calculate padding (20% of size for maskable area)
    padding=$((size / 5))
    innerSize=$((size - (padding * 2)))
    
    convert -background "#0a0f1e" \
        -gravity center \
        -extent ${size}x${size} \
        -resize ${innerSize}x${innerSize} \
        icon-template.svg \
        icons/maskable-icon-${size}.png
    echo "  ✅ Generated maskable ${size}x${size}"
done

echo ""
echo "🍎 Generating Apple touch icons..."
for size in 152 167 180; do
    convert -background none -resize ${size}x${size} icon-template.svg icons/apple-touch-icon-${size}.png
    echo "  ✅ Generated Apple ${size}x${size}"
done

echo ""
echo "📱 Generating favicons..."
convert -background none -resize 32x32 icon-template.svg favicon.ico
convert -background none -resize 192x192 icon-template.svg icons/android-chrome-192x192.png
convert -background none -resize 512x512 icon-template.svg icons/android-chrome-512x512.png
echo "  ✅ Generated favicon.ico"
echo "  ✅ Generated android-chrome icons"

echo ""
echo "✨ Icon generation complete!"
echo "📁 Check the /icons directory for all assets"