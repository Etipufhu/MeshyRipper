# Meshy.ai 3D Model Ripper

> **⚠️ Disclaimer:** This project is intended **strictly for educational and research purposes only**. It demonstrates browser automation techniques, API interception patterns, and binary file format (GLB/glTF) handling. The authors do not encourage or condone unauthorized downloading, redistribution, or misuse of copyrighted 3D models. Always respect the terms of service of any platform you interact with. Use at your own risk.

A tool that demonstrates how to extract 3D model data (GLB files) from web-based 3D viewers using browser automation and API interception techniques.

## How It Works

1. You paste a Meshy.ai workspace URL into the web interface
2. A Puppeteer-controlled browser opens and navigates to the page
3. The injected script hooks into the browser's `Worker`, `URL.createObjectURL`, and `fetch` APIs to intercept GLB model data
4. When a GLB file is detected, it's automatically sent to the Node.js server and saved to the `downloads/` folder
5. The browser tab closes automatically after the model is saved

## Educational Topics Covered

- **Browser Automation** — Using Puppeteer to control Chromium-based browsers programmatically
- **JavaScript API Hooking** — Intercepting native browser APIs (`Worker`, `fetch`, `URL.createObjectURL`)
- **Binary File Formats** — Understanding the GLB/glTF 2.0 binary container format and its magic bytes (`0x46546C67`)
- **Web Worker Communication** — Monitoring `postMessage` data between main thread and Web Workers
- **Express.js Server** — Building a simple API server with binary data handling

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
