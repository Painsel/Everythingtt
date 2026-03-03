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

// 1. Aggressive DevTools Killer & Detection
let devtoolsOpen = false;
let lockdownActive = false;
let detectionCount = 0;

// Aggressive "Killer" function: stalls DevTools by repeatedly triggering debugger
// and using Function constructor to bypass some static analysis.
function killDevTools() {
    if (lockdownActive) return;

    const start = performance.now();
    // Use Function constructor to make it harder to ignore
    (function() { return false; }['constructor']('debugger')());
    const end = performance.now();
    
    if (end - start > 100) {
        detectionCount++;
        logActivity(`Anti-debugging: stall #${detectionCount}`, 'alert');
        
        // If detected too many times (e.g., 5 times in a row), trigger lockdown
        if (detectionCount > 5) {
            triggerLockdown();
        } else {
            // Keep stalling if open
            setTimeout(killDevTools, 50);
        }
    } else {
        // Reset count if it's closed
        detectionCount = 0;
    }
}

function triggerLockdown() {
    if (lockdownActive) return;
    lockdownActive = true;
    
    document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#1e293b; color:#ef4444; font-family:sans-serif; text-align:center; padding:20px;">
            <h1 style="font-size:3rem; margin-bottom:1rem;">SECURITY LOCKDOWN</h1>
            <p style="font-size:1.2rem; margin-bottom:2rem;">Unauthorized inspection detected. Access to this page has been revoked for security reasons.</p>
            <button onclick="location.reload()" style="padding:12px 24px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">Restart Session</button>
        </div>
    `;
    logActivity('SYSTEM LOCKDOWN: Access revoked due to persistent debugging', 'alert');
}

function detectDevTools() {
    if (lockdownActive) return;
    
    const statusDevTools = document.getElementById('status-devtools');
    let detectedThisRound = false;

    // Method 1: Timing check (debugger)
    const startTime = performance.now();
    (function() { return false; }['constructor']('debugger')());
    if (performance.now() - startTime > 100) {
        detectedThisRound = true;
    }

    // Method 2: Resize check (only if not full screen)
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    if (widthDiff > threshold || heightDiff > threshold) {
        detectedThisRound = true;
    }

    // Method 3: Trap on function toString (often triggered by DevTools inspection)
    const func = function() {};
    let toStringTriggered = false;
    func.toString = function() {
        toStringTriggered = true;
        return 'trap';
    };
    // DevTools often calls toString on objects when inspecting
    if (toStringTriggered) {
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
    logActivity('Starting Incognito/Private Mode scan...', 'system');
    const statusIncognito = document.getElementById('status-incognito');
    let isIncognito = false;
    let detectionReasons = [];

    // Helper to update status as soon as something is found
    const setIncognito = (reason) => {
        if (!isIncognito) {
            isIncognito = true;
            statusIncognito.textContent = 'DETECTED';
            statusIncognito.className = 'status negative';
        }
        if (!detectionReasons.includes(reason)) {
            detectionReasons.push(reason);
            logActivity(`Private/Incognito mode detected! (Reason: ${reason})`, 'alert');
        }
    };

    // A. Chrome & Chromium-based (Edge, Brave, etc.) - Storage Quota Heuristic
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { quota } = await navigator.storage.estimate();
        // Chrome Incognito quota is usually much smaller (heuristics)
        // On many machines, it's around 10% of the disk but limited in incognito
        if (quota < 120000000) {
            setIncognito('Low storage quota');
        }
    }

    // B. Chrome & Chromium-based - FileSystem API (Legacy check)
    if (window.webkitRequestFileSystem) {
        window.webkitRequestFileSystem(window.TEMPORARY, 1, () => {
            // Success in normal mode
        }, () => {
            setIncognito('FileSystem API restricted');
        });
    }

    // C. IndexedDB (Firefox & Safari)
    try {
        const db = indexedDB.open("test_incognito_modern");
        db.onerror = () => {
            setIncognito('IndexedDB access denied');
        };
        db.onsuccess = () => {
            // Normal mode
        };
    } catch (e) {
        setIncognito('IndexedDB exception');
    }

    // D. Safari specific (Modern)
    if (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
        try {
            localStorage.setItem("test_incognito_safari", "1");
            localStorage.removeItem("test_incognito_safari");
        } catch (e) {
            setIncognito('LocalStorage disabled (Safari)');
        }
    }

    // E. Service Worker check (Firefox)
    if ('serviceWorker' in navigator) {
        try {
            // Service worker registrations often fail in private mode in older versions
            await navigator.serviceWorker.getRegistrations();
        } catch (e) {
            setIncognito('ServiceWorker access denied');
        }
    }

    // F. StorageManager Persist check
    if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
            const isPersisted = await navigator.storage.persisted();
            if (!isPersisted) {
                // Try to persist - this usually fails or is denied in incognito
                const result = await navigator.storage.persist();
                if (!result && isIncognito === false) {
                    // This is not a definitive check on its own, but can be a hint
                    setIncognito('Storage persistence denied');
                }
            }
        } catch (e) {}
    }

    // G. Final check for "Normal Mode" if nothing was found after a short delay
    setTimeout(() => {
        if (!isIncognito && statusIncognito.textContent === 'Checking...') {
            statusIncognito.textContent = 'Normal Mode';
            statusIncognito.className = 'status positive';
            logActivity('Incognito check completed: Normal mode confirmed', 'system');
        }
    }, 5000); // Increased to 5s for more reliability
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

// 11. Hardware-Level & Sandbox Detection
async function detectHardware() {
    const statusHardware = document.getElementById('status-hardware');
    const hardwareList = document.getElementById('hardware-list');
    const statusBypass = document.getElementById('status-bypass');
    hardwareList.innerHTML = '';
    let isSandbox = false;
    let sandboxReasons = [];

    const addInfo = (label, value) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${label}:</strong> ${value}`;
        hardwareList.appendChild(li);
    };

    // CPU Cores
    const cores = navigator.hardwareConcurrency || 0;
    addInfo('CPU Cores', cores || 'Unknown');
    if (cores === 1 || cores === 2) {
        isSandbox = true;
        sandboxReasons.push(`Low cores (${cores})`);
    }

    // RAM (Device Memory)
    const ram = navigator.deviceMemory || 0;
    addInfo('RAM (Approx)', ram ? `${ram} GB+` : 'Unknown');
    if (ram === 1 || ram === 2) {
        isSandbox = true;
        sandboxReasons.push(`Low RAM (${ram}GB)`);
    }

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
            
            // Heuristic for VMs/Software rendering
            const lowerRenderer = renderer.toLowerCase();
            const virtualizationStrings = ['virtualbox', 'vmware', 'software adapter', 'swiftshader', 'mesa', 'llvmpipe', 'parallels'];
            virtualizationStrings.forEach(v => {
                if (lowerRenderer.includes(v)) {
                    isSandbox = true;
                    sandboxReasons.push(`Virtualized GPU (${v})`);
                }
            });
        }
    } catch (e) {
        addInfo('GPU', 'Detection failed');
    }

    // Battery Info (Virtual machines often lack battery or have static values)
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
    
    statusHardware.textContent = 'Hardware Profiled';
    statusHardware.className = 'status positive';

    // Automation Check (part of bypass detection)
    let isAutomated = false;
    let automationReasons = [];
    if (navigator.webdriver) {
        isAutomated = true;
        automationReasons.push('navigator.webdriver=true');
    }
    if (window.name && (window.name.includes('cdc_') || window.name.includes('selenium'))) {
        isAutomated = true;
        automationReasons.push('Automation window signature');
    }
    // Headless detection
    if (navigator.plugins && navigator.plugins.length === 0) {
        isAutomated = true;
        automationReasons.push('No plugins (potential Headless mode)');
    }

    if (isAutomated || isSandbox) {
        statusBypass.textContent = isAutomated ? 'AUTOMATION DETECTED' : 'SANDBOX DETECTED';
        statusBypass.className = 'status negative';
        const allReasons = [...automationReasons, ...sandboxReasons].join(', ');
        logActivity(`Bypass heuristic triggered: ${allReasons}`, 'alert');
    } else {
        statusBypass.textContent = 'Normal Client';
        statusBypass.className = 'status positive';
    }

    logActivity('Hardware and environment scan complete', 'info');
}

// 12. Input Heuristics (Bot detection)
let lastMouseX = -1;
let lastMouseY = -1;
let straightLineCount = 0;
let humanLikelihood = 0;

document.addEventListener('mousemove', (e) => {
    if (lastMouseX !== -1) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        
        // Simple heuristic: bots often move in perfectly straight lines or jumps
        if (dx === 0 || dy === 0) {
            straightLineCount++;
        }
        
        // Increment human likelihood on movement
        humanLikelihood++;
    }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

// Detect bot-like clicks
document.addEventListener('mousedown', (e) => {
    // Check if the click has no pressure (some bot tools lack pressure data)
    // or if the click happened too quickly after mouse movement stopped
    if (e.isTrusted === false) {
        logActivity('Non-trusted click event detected (Bot Tool)', 'alert');
        const statusBypass = document.getElementById('status-bypass');
        statusBypass.textContent = 'INPUT AUTOMATION';
        statusBypass.className = 'status negative';
    }
});

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

// 13. Desktop Scanner Integration (Python Backend)
async function checkDesktopScanner() {
    const statusScan = document.getElementById('status-desktop-scan');
    const scanList = document.getElementById('desktop-scan-list');
    
    try {
        const response = await fetch('http://localhost:8001/scan');
        if (response.ok) {
            const detected = await response.json();
            
            if (detected.length > 0) {
                statusScan.textContent = 'DETECTED';
                statusScan.className = 'status negative';
                scanList.innerHTML = '';
                detected.forEach(proc => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${proc.name}</strong> (${proc.type})`;
                    scanList.appendChild(li);
                });
                logActivity(`Desktop scanner found ${detected.length} automation processes!`, 'alert');
            } else {
                statusScan.textContent = 'CLEAN';
                statusScan.className = 'status positive';
                scanList.innerHTML = '<li>No desktop automation found</li>';
            }
        }
    } catch (e) {
        statusScan.textContent = 'OFFLINE';
        statusScan.className = 'status neutral';
        scanList.innerHTML = '<li>Desktop agent not running on port 8001</li>';
    }
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
    checkDesktopScanner();

    // DevTools check and kill loop
    setInterval(detectDevTools, 2000);
    setInterval(killDevTools, 1000);
    setInterval(killUserscripts, 3000); // Periodic userscript check
    setInterval(checkDesktopScanner, 5000); // Periodic desktop scan
    window.addEventListener('resize', detectDevTools);
    detectDevTools();
};
