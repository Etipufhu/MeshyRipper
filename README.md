# Meshy.ai 3D Model Ripper

A tool to extract/download 3D models (GLB files) from [Meshy.ai](https://www.meshy.ai) workspace pages.

## How It Works

1. You paste a Meshy.ai workspace URL into the web interface
2. A Puppeteer-controlled browser opens and navigates to the page
3. The injected script hooks into the browser's `Worker`, `URL.createObjectURL`, and `fetch` APIs to intercept GLB model data
4. When a GLB file is detected, it's automatically sent to the Node.js server and saved to the `downloads/` folder
5. The browser tab closes automatically after the model is saved

## Installation

```bash
npm install
```

## Usage

### Option 1: Using start.bat (Windows)
Double-click `start.bat`

### Option 2: Manual
```bash
node server.js
```

Then open [http://localhost:3001](http://localhost:3001) in your browser.

## Requirements

- Node.js 18+
- Google Chrome (used by Puppeteer)

## Project Structure

```
meshy_ripper/
├── server.js          # Express server + Puppeteer automation
├── public/
│   └── index.html     # Web UI
├── downloads/         # Downloaded GLB files are saved here
├── start.bat          # Windows startup script
└── package.json
```

## License

MIT
