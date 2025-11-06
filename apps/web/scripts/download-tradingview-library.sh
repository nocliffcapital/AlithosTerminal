#!/bin/bash

# Script to download TradingView Charting Library
# Note: This requires manual download from TradingView's website
# Visit: https://www.tradingview.com/charting-library/

set -e

echo "TradingView Charting Library Download Setup"
echo "=========================================="
echo ""
echo "The TradingView Charting Library must be downloaded manually from:"
echo "https://www.tradingview.com/charting-library/"
echo ""
echo "After downloading:"
echo "1. Extract the zip file"
echo "2. Copy the 'charting_library' folder to apps/web/public/"
echo "3. The folder structure should be: apps/web/public/charting_library/"
echo ""
echo "Would you like to open the download page? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        # macOS
        open "https://www.tradingview.com/charting-library/"
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "https://www.tradingview.com/charting-library/"
    elif command -v start &> /dev/null; then
        # Windows
        start "https://www.tradingview.com/charting-library/"
    else
        echo "Please manually visit: https://www.tradingview.com/charting-library/"
    fi
fi

echo ""
echo "Checking if charting_library folder exists..."
if [ -d "apps/web/public/charting_library" ]; then
    echo "✓ Charting library found at apps/web/public/charting_library"
    echo "✓ Setup complete!"
else
    echo "✗ Charting library not found"
    echo "Please download and extract it to apps/web/public/charting_library/"
fi



