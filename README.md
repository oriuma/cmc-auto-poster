# Social Media Auto Poster 🚀

Multi-platform social media scheduler Chrome extension for automated posting.

## Supported Platforms

- 📊 **CoinMarketCap Community** (Gravity)
- 🟫 **Binance Square**

## Features

✨ **Multi-Platform Support** - Schedule posts to multiple platforms simultaneously

⏰ **Smart Scheduling** - Set exact date and time for each post

🖼️ **Image Support** - Attach images to your posts

🎨 **Visual Feedback** - Beautiful animated indicator shows when extension is working

💾 **Local Storage** - All scheduled posts stored securely in your browser

🔄 **Automatic Retry** - Extended wait times for slow-loading sites

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. Make sure you're logged in to CoinMarketCap and Binance before scheduling posts

## How to Use

1. Click the extension icon in your Chrome toolbar
2. Write your post content
3. (Optional) Add an image
4. Select target platforms using checkboxes
5. Set the publish time
6. Click "Schedule Post"

### Visual Indicator

When the extension starts working, you'll see:
- 🎯 A floating badge in the top-right corner
- ✨ Sparkle particles animation
- 🟢 Blinking activity indicator

This lets you know the extension is actively posting!

## Technical Details

- **Manifest Version**: 3
- **Permissions**: Storage, Alarms, Scripting, Tabs
- **Architecture**: Modular platform handlers
- **Wait Strategy**: Smart page load detection with fallback timeouts

## Platform-Specific Notes

### CoinMarketCap
- Posts to your profile's community feed
- Automatically selects "Bullish" sentiment
- Uses clipboard paste strategy for reliable text input

### Binance Square
- Posts to main Binance Square feed
- Detects yellow "Post" button by color
- Robust editor detection via placeholder text

## Troubleshooting

**Post not publishing?**
- Make sure you're logged in to the platform
- Check browser console (F12) for error messages
- Extension waits up to 40 seconds for page load - slow connections might need manual retry

**Text not appearing?**
- The extension uses clipboard paste simulation, which works best with React-based editors
- If text doesn't appear, try manually posting once to "wake up" the site's editor

**Images not uploading?**
- Ensure image file is under 5MB
- Check that the platform allows image uploads (some posts may be text-only)

## Contributing

Feel free to submit issues or pull requests!

## Version History

- **v2.0** - Multi-platform support, visual indicators, improved wait times
- **v1.0** - Initial CoinMarketCap-only version

## License

MIT License - Free to use and modify

---

Made with ❤️ for crypto community automation