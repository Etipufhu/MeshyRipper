const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Blob receiver
app.post('/api/save_glb', express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
    let filename = req.headers['x-filename'] || `meshy_${Date.now()}.glb`;
    // decode URI component in case of special characters
    filename = decodeURIComponent(filename);
    const savePath = path.join(DOWNLOADS_DIR, filename);
    
    fs.writeFileSync(savePath, req.body);
    console.log(`\n✅ Model saved successfully: ${savePath}`);
    
    // We send a success response to the browser
    res.json({ success: true, file: filename });
});

let browser = null;

app.post('/api/rip', async (req, res) => {
    const { url } = req.body;
    
    if (!url || !url.includes('meshy.ai')) {
        return res.status(400).json({ error: 'Please enter a valid meshy.ai URL.' });
    }

    console.log(`\n[*] Starting rip: ${url}`);
    res.json({ message: 'Rip started. Opening browser...', status: 'starting' });

    try {
        if (!browser) {
            browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: ['--start-maximized', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
            });
        }

        const page = await browser.newPage();
        await page.setBypassCSP(true);
        
        // ==========================================
        // Inject Ripper Script into the Page
        // ==========================================
        const scriptCode = `
            window.__meshyRipperInjected = true;
            window.__meshyGLBs = [];

            function getModelFilename() {
                const title = document.querySelector('h1')?.textContent || '';
                const safeTitle = title.replace(/[<>:"/\\\\|?*\\x00-\\x1F-]+/g, '-').replace(/\\s+/g, ' ').replace(/^[.\\s-]+|[.\\s-]+$/g, '');
                return safeTitle ? safeTitle + '.glb' : 'meshy_' + Date.now() + '.glb';
            }

            // Modified capture function from the original script: POSTs the file to localhost
            async function captureGLB(blob, src) {
                const filename = getModelFilename();
                console.log('[MeshyRipper] GLB Captured! Sending to Node.js server... Size:', blob.size);
                
                try {
                    const response = await fetch('http://localhost:${PORT}/api/save_glb', {
                        method: 'POST',
                        body: blob,
                        headers: {
                            'x-filename': encodeURIComponent(filename)
                        }
                    });
                    
                    if (response.ok) {
                        console.log('[MeshyRipper] Successfully saved to server!');
                        // Signal completion to close the window
                        window.postMessage({ type: 'RIP_COMPLETE' }, '*');
                    }
                } catch (e) {
                    console.error('[MeshyRipper] Error sending to server:', e);
                }
            }

            // Worker Hook
            const _OrigWorker = window.Worker;
            window.Worker = function(scriptURL, options) {
                const w = new _OrigWorker(scriptURL, options);
                const proto = Object.getPrototypeOf(w);
                const desc = Object.getOwnPropertyDescriptor(proto, 'onmessage');
                if (desc && desc.set) {
                    Object.defineProperty(w, 'onmessage', {
                        configurable: true,
                        get() { return desc.get ? desc.get.call(w) : undefined; },
                        set(fn) {
                            desc.set.call(w, function(e) {
                                spyWorkerMsg(e);
                                return fn.call(this, e);
                            });
                        }
                    });
                }
                const _origAEL = w.addEventListener.bind(w);
                w.addEventListener = function(type, listener, opts) {
                    if (type === 'message') {
                        return _origAEL(type, function(e) {
                            spyWorkerMsg(e);
                            return listener.call(this, e);
                        }, opts);
                    }
                    return _origAEL(type, listener, opts);
                };
                return w;
            };
            window.Worker.prototype = _OrigWorker.prototype;

            function spyWorkerMsg(e) {
                const d = e.data;
                if (!d || !d.type) return;
                if (d.type === 'process' && d.success && d.data) {
                    try {
                        const copy = d.data.slice(0);
                        captureGLB(new Blob([copy], { type: 'model/gltf-binary' }), 'worker');
                    } catch(ex) {}
                }
            }

            // URL.createObjectURL Hook
            const _origCreateObjectURL = URL.createObjectURL.bind(URL);
            URL.createObjectURL = function(blob) {
                const url = _origCreateObjectURL(blob);
                if (blob instanceof Blob || blob instanceof File) {
                    if (blob.type === 'model/gltf-binary') {
                        captureGLB(blob, 'createObjectURL');
                    } else if (blob.size > 100000) {
                        blob.arrayBuffer().then(buf => {
                            if (buf && buf.byteLength >= 4 && new Uint32Array(buf.slice(0, 4))[0] === 0x46546C67) {
                                captureGLB(new Blob([buf], { type: 'model/gltf-binary' }), 'createObjectURL-magic');
                            }
                        }).catch(() => {});
                    }
                }
                return url;
            };

            // fetch Hook
            const _origFetch = window.fetch;
            window.fetch = async function(input) {
                const url = typeof input === 'string' ? input : (input && input.url) || String(input);
                const p = _origFetch.apply(this, arguments);
                if (!url.includes('.glb') && !url.includes('misc/cdn-models')) return p;
                
                return p.then(async resp => {
                    try {
                        const buf = await resp.clone().arrayBuffer();
                        if (buf && buf.byteLength >= 4 && new Uint32Array(buf.slice(0, 4))[0] === 0x46546C67) {
                            captureGLB(new Blob([buf], { type: 'model/gltf-binary' }), 'fetch');
                        }
                    } catch(ex) {}
                    return resp;
                });
            };
        `;

        await page.evaluateOnNewDocument(scriptCode);
        
        // Navigate to meshy.ai
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Listen for messages from the page (to close the browser when download is complete)
        page.on('console', async msg => {
            const text = msg.text();
            console.log('[Browser]', text);
        });

        await page.exposeFunction('closeBrowser', async () => {
            console.log('Model downloaded. Closing browser...');
            await page.close();
        });

        await page.evaluateOnNewDocument(() => {
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'RIP_COMPLETE') {
                    window.closeBrowser();
                }
            });
        });

    } catch (error) {
        console.error('Error occurred:', error);
    }
});

app.listen(PORT, () => {
    console.log(`\n======================================`);
    console.log(` 🚀 Meshy.ai 3D Model Ripper Server 🚀`);
    console.log(`======================================`);
    console.log(` [*] Access the interface at http://localhost:${PORT}\n`);
});
