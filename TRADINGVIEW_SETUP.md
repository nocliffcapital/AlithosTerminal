# TradingView Chart Card Setup

The TradingView Chart Card requires the TradingView Charting Library to display custom Polymarket data.

## Quick Setup

1. **Download the TradingView Charting Library**
   - Visit: https://www.tradingview.com/charting-library/
   - Sign up or log in (free account works)
   - Download the latest version of the Charting Library

2. **Extract and Place the Library**
   - Extract the downloaded zip file
   - Copy the `charting_library` folder to `apps/web/public/`
   - The final path should be: `apps/web/public/charting_library/`

3. **Verify Installation**
   - Check that `apps/web/public/charting_library/charting_library.min.js` exists
   - The folder should contain various JS files and folders

## Alternative: Use Setup Script

Run the setup script to get instructions:

```bash
cd apps/web
./scripts/download-tradingview-library.sh
```

## Fallback Behavior

If the Charting Library is not installed, the card will:
- Use TradingView's free embedded widget (iframe-based)
- Display a basic chart (without custom Polymarket data)
- Show a message indicating the library is needed for full functionality

## Notes

- The Charting Library is free for personal/educational use
- Commercial use may require a license
- The library is large (~10MB+), so ensure it's in `.gitignore`
- The library enables full customization and custom data feeds

## Troubleshooting

If the chart doesn't load:
1. Check browser console for errors
2. Verify the library path is correct: `/charting_library/charting_library.min.js`
3. Ensure the library files are accessible (not blocked by server)
4. Check that the library version is compatible with the widget API



