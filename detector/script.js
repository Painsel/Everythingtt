// Utility to log activities
function logActivity(message, type = 'info') {
    const logContainer = document.getElementById('log-container');
    const entry = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    entry.className = `log-entry ${type}`;
    entry.setAttribute('data-time', time);
    entry.textContent = message;
    logContainer.prepend(entry);
    console.log(`[${time}] ${message}`);
}

// 1. Improved DevTools Detection & KILLER
let devtoolsOpen = false;

// The "Killer" function: stalls DevTools by repeatedly triggering debugger
function killDevTools() {
    const start = performance.now();
    debugger; // This will pause execution ONLY if DevTools is open
    const end = performance.now();
    
    // If it took longer than 100ms, DevTools is likely open
    if (end - start > 100) {
        logActivity('Anti-debugging: stalling DevTools...', 'alert');
        // Self-calling loop to keep stalling if open
        setTimeout(killDevTools, 100);
    }
}

function detectDevTools() {
    const statusDevTools = document.getElementById('status-devtools');
    let detectedThisRound = false;

    // Method 1: Timing check (debugger)
    const startTime = performance.now();
    debugger;
    if (performance.now() - startTime > 100) {
        detectedThisRound = true;
    }

    // Method 2: Resize check (only if not full screen)
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    if (widthDiff > threshold || heightDiff > threshold) {
        // This is a strong hint if the user isn't just using a very large window border
        detectedThisRound = true;
    }

    // Method 3: Console formatters (Modern Chrome/Firefox)
    const devtools = /./;
    devtools.toString = function() {
        detectedThisRound = true;
        return 'devtools';
    }
    console.log(devtools);

    // Method 4: Getter on object logged to console
    const element = new Image();
    Object.defineProperty(element, 'id', {
        get: function() {
            detectedThisRound = true;
            return 'devtools-detector';
        }
    });
    console.log(element);

    if (detectedThisRound) {
        if (!devtoolsOpen) {
            devtoolsOpen = true;
            statusDevTools.textContent = 'DETECTED';
            statusDevTools.className = 'status negative';
            logActivity('Developer Tools detected!', 'alert');
        }
    } else {
        if (devtoolsOpen) {
            devtoolsOpen = false;
            statusDevTools.textContent = 'Not detected';
            statusDevTools.className = 'status positive';
            logActivity('Developer Tools closed', 'info');
        }
    }
}

// 2. Improved Incognito/Private Mode Detection
async function detectIncognito() {
    const statusIncognito = document.getElementById('status-incognito');
    let isIncognito = false;
    let detectionReasons = [];

    // A. Chrome & Chromium-based (Edge, Brave, etc.)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { quota } = await navigator.storage.estimate();
        // Chrome Incognito quota is usually much smaller (heuristics)
        if (quota < 120000000) {
            isIncognito = true;
            detectionReasons.push('Low storage quota');
        }
    }

    // B. FileSystem API (Legacy but still useful for some browsers)
    if (window.webkitRequestFileSystem) {
        window.webkitRequestFileSystem(window.TEMPORARY, 1, () => {
            // Success in normal mode
        }, () => {
            isIncognito = true; // Fails in incognito
            detectionReasons.push('FileSystem API disabled');
            updateIncognitoStatus(isIncognito, detectionReasons);
        });
    }

    // C. IndexedDB (Firefox & Safari)
    try {
        const db = indexedDB.open("test_incognito");
        db.onerror = () => {
            isIncognito = true;
            detectionReasons.push('IndexedDB access denied');
            updateIncognitoStatus(isIncognito, detectionReasons);
        };
        db.onsuccess = () => {
            // Check if we can actually write
            updateIncognitoStatus(isIncognito, detectionReasons);
        };
    } catch (e) {
        isIncognito = true;
        detectionReasons.push('IndexedDB exception');
        updateIncognitoStatus(isIncognito, detectionReasons);
    }

    // D. Safari specific (Modern)
    if (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
        try {
            localStorage.setItem("test_incognito", "1");
            localStorage.removeItem("test_incognito");
        } catch (e) {
            isIncognito = true;
            detectionReasons.push('LocalStorage disabled (Safari)');
        }
    }

    // E. Service Worker check (Firefox)
    if ('serviceWorker' in navigator) {
        // In some browsers/versions, Service Workers are disabled in private mode
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
        } catch (e) {
            isIncognito = true;
            detectionReasons.push('ServiceWorker access denied');
        }
    }

    updateIncognitoStatus(isIncognito, detectionReasons);
}

function updateIncognitoStatus(isIncognito, reasons = []) {
    const statusIncognito = document.getElementById('status-incognito');
    if (isIncognito) {
        statusIncognito.textContent = 'DETECTED';
        statusIncognito.className = 'status negative';
        const reasonStr = reasons.length > 0 ? ` (Reason: ${reasons.join(', ')})` : '';
        logActivity(`Private/Incognito mode detected!${reasonStr}`, 'alert');
    } else {
        statusIncognito.textContent = 'Normal Mode';
        statusIncognito.className = 'status positive';
    }
}

// 3. Click Monitoring
let clickCount = 0;
document.addEventListener('click', (e) => {
    clickCount++;
    const statusClicks = document.getElementById('status-clicks');
    statusClicks.textContent = `${clickCount} Clicks`;
    statusClicks.className = 'status neutral';
    logActivity(`Click at (${e.clientX}, ${e.clientY}) on ${e.target.tagName}`, 'info');
});

// 4. Context Menu Blocking & Monitoring
document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // KILL context menu
    const statusContextMenu = document.getElementById('status-contextmenu');
    statusContextMenu.textContent = 'BLOCKED';
    statusContextMenu.className = 'status negative';
    logActivity('Right-click context menu BLOCKED!', 'alert');
});

// 5. Keyboard Shortcuts Blocking & Monitoring
document.addEventListener('keydown', (e) => {
    const statusShortcuts = document.getElementById('status-shortcuts');
    const keyCombo = [];
    if (e.ctrlKey) keyCombo.push('Ctrl');
    if (e.shiftKey) keyCombo.push('Shift');
    if (e.altKey) keyCombo.push('Alt');
    keyCombo.push(e.key);

    const comboStr = keyCombo.join('+');

    // Detect F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    const isInspection = (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
    );

    if (isInspection) {
        e.preventDefault(); // KILL inspection shortcuts
        statusShortcuts.textContent = `BLOCKED: ${comboStr}`;
        statusShortcuts.className = 'status negative';
        logActivity(`Inspection shortcut BLOCKED: ${comboStr}`, 'alert');
    } else {
        statusShortcuts.textContent = `Last key: ${comboStr}`;
        statusShortcuts.className = 'status neutral';
    }
});

// 6. Window Focus/Blur Monitoring
window.addEventListener('focus', () => {
    const statusFocus = document.getElementById('status-focus');
    statusFocus.textContent = 'Focused';
    statusFocus.className = 'status positive';
    logActivity('Window focused', 'info');
});

window.addEventListener('blur', () => {
    const statusFocus = document.getElementById('status-focus');
    statusFocus.textContent = 'Blurred (Inactive)';
    statusFocus.className = 'status negative';
    logActivity('Window blurred / focus lost', 'alert');
});

// 7. Screen and Fullscreen Monitoring
window.addEventListener('resize', () => {
    const statusScreen = document.getElementById('status-screen');
    statusScreen.textContent = 'RESIZED';
    statusScreen.className = 'status neutral';
    logActivity(`Window resized to ${window.innerWidth}x${window.innerHeight}`, 'info');
    
    // Reset status after a short delay
    setTimeout(() => {
        if (statusScreen.textContent === 'RESIZED') {
            statusScreen.textContent = 'Stable';
            statusScreen.className = 'status positive';
        }
    }, 2000);
});

document.addEventListener('fullscreenchange', () => {
    const statusScreen = document.getElementById('status-screen');
    if (document.fullscreenElement) {
        statusScreen.textContent = 'FULLSCREEN';
        statusScreen.className = 'status negative';
        logActivity('Entered Fullscreen mode', 'alert');
    } else {
        statusScreen.textContent = 'Stable';
        statusScreen.className = 'status positive';
        logActivity('Exited Fullscreen mode', 'info');
    }
});

// 8. Media/Recording Detection (Permissions & DisplayMedia)
async function monitorMedia() {
    const statusMedia = document.getElementById('status-media');
    
    // Check for Screen Capture (if supported)
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // We can't actually detect if they ARE recording without asking, 
        // but we can detect if the API is available and if they start it.
    }

    // Monitor Visibility API for potential overlays
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            logActivity('Page hidden (user switched tab or minimized)', 'info');
        } else {
            logActivity('Page visible again', 'info');
        }
    });
}

// 9. DOM Injection Detection (MutationObserver)
function monitorDOMInjections() {
    const statusDOM = document.getElementById('status-dom');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    // Check if node is an element and not one we expected
                    if (node.nodeType === 1) {
                        const tag = node.tagName.toLowerCase();
                        // Many extensions inject <div>, <script>, or <link>
                        if (tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
                            statusDOM.textContent = 'INJECTION DETECTED';
                            statusDOM.className = 'status negative';
                            logActivity(`Suspicious element injected: <${tag}>`, 'alert');
                        } else {
                            // General DOM changes
                            statusDOM.textContent = 'DOM MODIFIED';
                            statusDOM.className = 'status neutral';
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// 10. Userscript Killer & Detection
function killUserscripts() {
    const statusUserscript = document.getElementById('status-userscript');
    let reasons = [];

    // Heuristic: Check for common manager globals
    const managers = ['GM_info', 'GM', 'Tampermonkey', 'unsafeWindow'];
    managers.forEach(m => {
        if (typeof window[m] !== 'undefined') {
            reasons.push(`Detected ${m}`);
        }
    });

    // Attempt to "freeze" or protect critical globals from being modified by userscripts
    try {
        // This is a defensive move; userscripts often try to wrap these
        const protect = (obj, prop) => {
            if (obj && obj[prop]) {
                Object.defineProperty(obj, prop, {
                    writable: false,
                    configurable: false
                });
            }
        };
        // Protect some core APIs (Note: this can break some legitimate site features)
        // protect(window, 'fetch');
        // protect(document, 'createElement');
    } catch (e) {}

    if (reasons.length > 0) {
        statusUserscript.textContent = 'NEUTRALIZING';
        statusUserscript.className = 'status negative';
        logActivity(`Userscript activity: ${reasons.join(', ')}`, 'alert');
    } else {
        statusUserscript.textContent = 'STABLE';
        statusUserscript.className = 'status positive';
    }
}

// 11. Hardware-Level Detection
async function detectHardware() {
    const statusHardware = document.getElementById('status-hardware');
    const hardwareList = document.getElementById('hardware-list');
    hardwareList.innerHTML = '';

    const addInfo = (label, value) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${label}:</strong> ${value}`;
        hardwareList.appendChild(li);
    };

    // CPU Cores
    const cores = navigator.hardwareConcurrency || 'Unknown';
    addInfo('CPU Cores', cores);

    // RAM (Device Memory) - limited to 8GB by most browsers for privacy
    const ram = navigator.deviceMemory ? `${navigator.deviceMemory} GB+` : 'Unknown';
    addInfo('RAM (Approx)', ram);

    // GPU Info (WebGL)
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown';
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
            addInfo('GPU Vendor', vendor);
            addInfo('GPU Renderer', renderer);
        }
    } catch (e) {
        addInfo('GPU', 'Detection failed');
    }

    // Battery Info
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            const level = Math.round(battery.level * 100) + '%';
            const charging = battery.charging ? 'Charging' : 'Not charging';
            addInfo('Battery', `${level} (${charging})`);
        } catch (e) {}
    }

    // Screen Info
    addInfo('Resolution', `${window.screen.width}x${window.screen.height}`);
    addInfo('Color Depth', `${window.screen.colorDepth}-bit`);

    statusHardware.textContent = 'Hardware Profiled';
    statusHardware.className = 'status positive';
    logActivity('Hardware-level scan complete', 'info');
}

// 12. Active Console Killing
function killConsole() {
    // Overwrite console methods to prevent data inspection
    const originalLog = console.log;
    const methods = ['log', 'warn', 'error', 'info', 'debug', 'table', 'dir'];
    
    methods.forEach(method => {
        const originalMethod = console[method];
        console[method] = function(...args) {
            // Still allow our internal logger to work but block others
            if (args[0] && typeof args[0] === 'string' && (args[0].startsWith('[') || args[0].startsWith('System'))) {
                originalMethod.apply(console, args);
            }
        };
    });

    // Periodically clear the console
    setInterval(() => {
        if (devtoolsOpen) {
            console.clear();
            logActivity('Console cleared by anti-debugging system', 'alert');
        }
    }, 1000);
}

// Initial Checks
window.onload = () => {
    logActivity('Security Dashboard Started', 'system');
    detectIncognito();
    monitorMedia();
    monitorDOMInjections();
    killUserscripts();
    detectHardware();
    killConsole();

    // DevTools check and kill loop
    setInterval(detectDevTools, 2000);
    setInterval(killDevTools, 1000);
    setInterval(killUserscripts, 3000); // Periodic userscript check
    window.addEventListener('resize', detectDevTools);
    detectDevTools();
};
