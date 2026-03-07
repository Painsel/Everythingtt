/**
 * AI CONTROLLER - Territorial Appraiser (Global Version)
 * 
 * This version uses the Hugging Face Inference API to provide a global AI
 * experience for all visitors without requiring local software.
 */

const AI_CONFIG = {
    // Models
    languageModel: "painsel/EverythingTT-v1-preview:free",
    codexModel: "painsel/EverythingTT-v1-preview-CODEX:free",
    currentModel: "painsel/EverythingTT-v1-preview:free",
    
    // Branded EverythingTT-v1-preview Endpoint (Local -> Ngrok Ephemeral)
    endpoint: "https://kecia-ungreeted-neologically.ngrok-free.dev/v1/chat/completions",
    // Handshake Key (Mandatory - Set by Auth system in AI.html)
    customKey: null
};

const APPRAISER_SYSTEM_PROMPT = `
You are the **EverythingTT-v1-preview (by painsel)**. 

### CORE DIRECTIVE:
You are an advanced analytical engine designed to bridge the gap between **territorial.io**'s low-level "Thick Client" code and the high-level economy documented in the **Wiki**. Your analysis must be clinical, high-fidelity, and authoritative.

### AI CAPABILITIES & TOOLS:
- **URL CONTEXT**: You can "see" URLs provided by the user. Analyze them as clinical data sources.
- **CODE EXECUTION**: You can generate JavaScript snippets. Use standard markdown code blocks with 'js' language tags. The user has a "Run" button to execute them in their browser environment.
- **ADVANCED MARKDOWN**: Use the following structures for clinical density:
    - **Tables**: Use for account metrics, interest curves, or market rates.
    - **Callouts**: Use \` > [!INFO] \`, \` > [!WARNING] \`, or \` > [!SUCCESS] \` for strategic alerts.
    - **Reasoning**: Always start responses with internal reasoning in \`<thought>\` tags.

### 1. EVERYTHINGTT-V1-PREVIEW (BY PAINSEL) KNOWLEDGE:
- **PURPOSE**: A community-driven real-time account appraisal and market exchange tool.
- **VALUATION METHODOLOGY**:
    - **Gold**: $1.99 per 1,000 Gold.
    - **ETT Tokens**: $5.99 per 4,100 ETT.
    - **Robux**: $4.99 per 400 Robux.
- **NAME PRESTIGE**: Linguistic analysis for account value bonuses.
    - **Legendary Short**: +$25.00 for 2-3 clean alpha characters.
    - **Premium Short**: +$5.00 for <= 5 characters.
    - **Clean Alpha**: +$5.00 for only A-Z characters.
    - **Dictionary OG**: +$15.00 for high-demand terms (e.g., "rich", "king").
    - *Anti-Abuse*: Bonuses require >= 5,000 gold or Top 1,000 rank to apply.
- **FEATURES**:
    - **Global API**: Shared community account (**2mQnt**) for anonymous scans.
    - **Correction Mode**: Manual override for API-scanned metrics (Gold, Ranks, Points).
    - **Report Publishing**: Sanitized HTML upload to PageDrop via Public API.
    - **Security**: Direct browser-to-game communication; zero server-side credential storage.

### 2. ENGINE-LEVEL INTELLIGENCE (SOURCE CODE):
- **THICK CLIENT**: David Tschacher's engine is a monolithic JavaScript application using a single \`<canvas id="canvasA">\`. It bypasses standard HTML UI for a direct 2D Canvas API rendering pipeline.
- **INTEREST CALCULATION**: Resources grow based on land mass and current balance. Interest follows an exponential growth curve limited by game-tick updates.
- **PURGE LOGIC**: The "8-Day Purge" is a hard-coded garbage collection. Accounts with 0 gold are flagged and deleted after 8 days of inactivity.
- **SOCIAL COSTS**: Lobby interaction (@mentions) is a deflationary gold sink costing 0.10 gold per player mentioned.

### 3. WIKI-VERIFIED ECONOMIC DATA:
- **GOLD DECAY**: Nightly deduction ranges from 0.50 gold up to 0.01% of total reserves. Top 90 players have slightly lower decay rates (0.001%-0.0099%).
- **TITLES**: 12 wealth tiers from **Beggar** (<3 gold) to **Capitalist** (>=30k gold) and **Richest Player**.
- **CLANS**: 1-7 character tag constraints. "Primary Clan" points determine leadership and political power in elections.

### 4. THINKING MODE PROTOCOL (STEP-BY-STEP):
You MUST provide your internal reasoning inside \`<thought>\` tags using these specific labels:
- **[EXTRACTING_DATA]**: Parse scan results, user intent, or specific account metrics.
- **[ENGINE_SIMULATION]**: Analyze source-code verified mechanics (Interest, Purge, Expansion logic).
- **[WIKI_VALIDATION]**: Cross-reference against official game documentation (Decay, Titles, Clan mechanics).
- **[ECONOMIC_SYNTHESIS]**: Calculate USD worth, liquidity risks, and formulate strategic market advice using EverythingTT methodology.

### 5. ARCHITECTURAL BOUNDARY:
- **EverythingTT Appraiser**: `https://painsel.github.io/EverythingTT/terri-appraiser/` (Community analytical layer).
- **Official Game**: `https://territorial.io/` (The underlying infrastructure).

### 6. KNOWLEDGE BASE (CLINICAL SOURCES):
- **CORE INFRASTRUCTURE**:
    - Privacy: `https://territorial.io/privacy`
    - Terms: `https://territorial.io/terms`
    - Changelog: `https://territorial.io/changelog`
- **LIVE DATA**:
    - Clan Results: `https://territorial.io/clan-results`
    - Player Rankings: `https://territorial.io/players`
    - Clans List: `https://territorial.io/clans`
- **GAME LOGS**:
    - 1v1 Logs: `https://territorial.io/log/1v1`
    - Battle Royale: `https://territorial.io/log/br`
    - Zombies: `https://territorial.io/log/zombies`
    - Team Games: `https://territorial.io/log/team-games`
    - Propaganda: `https://territorial.io/log/propaganda`
- **WIKI & DOCUMENTATION**:
    - Wiki Home: `https://territorial.io/wiki`
    - Gold Wiki: `https://territorial.io/wiki/gold`
    - Clans Wiki: `https://territorial.io/wiki/clans`
    - API Wiki: `https://territorial.io/wiki/api`
    - Propaganda Wiki: `https://territorial.io/wiki/propaganda`
- **EVERYTHINGTT ECOSYSTEM**:
    - Security Center: `https://painsel.github.io/EverythingTT/detector`
    - Security Docs: `https://painsel.github.io/EverythingTT/detector/docs.html`
    - Security MD: `https://painsel.github.io/EverythingTT/detector/SECURITY.md`
    - Appraiser Home: `https://painsel.github.io/EverythingTT/terri-appraiser/`
    - API Docs: `https://painsel.github.io/EverythingTT/terri-appraiser/DOCS.html`
    - Zen Analyst (AI): `https://painsel.github.io/EverythingTT/terri-appraiser/AI.html`
    - Economy Dashboard: `https://painsel.github.io/EverythingTT/eco/`
    - Marketplace: `https://painsel.github.io/EverythingTT/eco/marketplace.html`
    - Inventory: `https://painsel.github.io/EverythingTT/eco/inventory.html`
    - Casino: `https://painsel.github.io/EverythingTT/eco/casino.html`
    - EverythingTT Times: `https://painsel.github.io/EverythingTT/news/`
    - Tube: `https://painsel.github.io/EverythingTT/tube/`

### 7. RESPONSE FORMAT:
- Start with the step-by-step reasoning in \`<thought>\` tags.
- Follow with a **Markdown-formatted** definitive response.
- Use tables for data density and bolding for emphasis.
- Always recommend verifying trades at the official Discord: https://discord.gg/DGTMnG9avc
`;

const AI = {
    isChatOpen: false,
    isRefreshing: false,
    isServerOnline: true,
    messageHistory: [], // NEW: Persistent conversation history for context
    maxHistory: 10,     // Keep last 10 messages for context window optimization

    init() {
        this.refreshApiKey();
        this.startHealthCheck();
    },

    async startHealthCheck() {
        // Clinical heartbeat every 10 seconds
        setInterval(async () => {
            try {
                const res = await fetch(`${Auth.baseUrl}/status`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (res.ok) {
                    this.isServerOnline = true;
                    document.getElementById('offline-overlay')?.classList.add('hidden');
                } else {
                    throw new Error("Server Response Error");
                }
            } catch (e) {
                this.isServerOnline = false;
                document.getElementById('offline-overlay')?.classList.remove('hidden');
                console.error("[EverythingTT] Connection severed. Backend unreachable.");
            }
        }, 10000);
    },

    /**
     * AI SKILL: Automatically handles the credential-to-fetch flow
     * @param {string} targetAccount 
     */
    async handleAutomatedScan(targetAccount) {
        const usernameField = document.getElementById('api-username');
        const passwordField = document.getElementById('api-password');
        const targetField = document.getElementById('target-username');
        const fetchBtn = document.getElementById('fetch-btn');

        // Check if fields are already filled or if we can load from localStorage
        let hasCreds = usernameField.value && passwordField.value;
        
        if (!hasCreds) {
            // Try to load from localStorage (calling the function defined in index.html)
            if (typeof loadFromLocalStorage === 'function') {
                hasCreds = loadFromLocalStorage();
            }
        }

        if (hasCreds || isGlobalApiActive) {
             this.addMessage("AI", `Credentials verified. I'm now initiating a scan for <strong>${targetAccount}</strong>...`);
             targetField.value = targetAccount;
             
             // Trigger the click on the fetch button
             fetchBtn.click();
             
             return true;
         } else {
             // FALLBACK: Offer to use Global API
             this.addMessage("AI", `I don't see any personal credentials, but don't worry! I'll use the <strong>Shared Community Account (2mQnt)</strong> to fetch the data for <strong>${targetAccount}</strong> instead.`);
             
             // Programmatically activate Global API (using the logic from index.html)
             const bannerBtn = document.getElementById('use-global-btn');
             if (bannerBtn && !isGlobalApiActive) {
                 bannerBtn.click();
             }
             
             targetField.value = targetAccount;
             setTimeout(() => {
                 fetchBtn.click();
             }, 300); // Small delay to ensure Global API state is updated
             
             return true;
         }
     },

    /**
     * Fetches the latest API key from JSONBin to prevent manual update needs
     */
    async refreshApiKey() {
        const JSONBIN_URL = "https://api.jsonbin.io/v3/b/69a6011aae596e708f58e218";
        
        try {
            const response = await fetch(JSONBIN_URL, {
                method: 'GET',
                headers: { 'X-Bin-Meta': 'false' }
            });
            
            if (response.ok) {
                const data = await response.json();
                const newKey = data.record?.api_key || data.api_key;
                
                if (newKey && newKey.startsWith("hf_")) {
                    console.log("[EverythingTT] Hugging Face API Key refreshed successfully.");
                    // In a production environment, this key would be used to authorize 
                    // requests to the backend or direct inference if configured.
                    this.hfKey = newKey;
                }
            }
        } catch (e) {
            console.warn("[EverythingTT] Failed to refresh API key from JSONBin. Using local defaults.");
        }

        // --- DYNAMIC ENDPOINT MAPPING ---
        if (AI_CONFIG.customKey) {
            const isPro = AI_CONFIG.customKey.startsWith("ett_pro_");
            const suffix = isPro ? "" : ":free";
            AI_CONFIG.languageModel = `painsel/EverythingTT-v1-preview${suffix}`;
            AI_CONFIG.codexModel = `painsel/EverythingTT-v1-preview-CODEX${suffix}`;
            
            // Update current model if it was one of the defaults
            const isCodex = AI_CONFIG.currentModel.includes("CODEX");
            AI_CONFIG.currentModel = isCodex ? AI_CONFIG.codexModel : AI_CONFIG.languageModel;
            
            console.log(`[EverythingTT] Engine mapping updated for ${isPro ? 'PRO' : 'FREE'} key.`);
        }
    },

    toggleChat() {
        const modal = document.getElementById('aiChatModal');
        // If we are on the main page, navigate to AI.html instead of showing modal
        if (!modal) {
            window.location.href = 'AI.html';
            return;
        }
        
        this.isChatOpen = !this.isChatOpen;
        if (this.isChatOpen) {
            modal.classList.remove('hidden-modal');
            // Refresh key on open to ensure it's fresh
            this.refreshApiKey();
            if (document.getElementById('ai-messages').children.length === 0) {
                this.addMessage("AI", "Hello! I am your Global AI Analyst. How can I help you with the Territorial market?");
            }
        } else {
            modal.classList.add('hidden-modal');
        }
    },

    setEngine(type) {
        if (type === 'language') {
            AI_CONFIG.currentModel = AI_CONFIG.languageModel;
            document.getElementById('model-tab-lang')?.classList.add('active');
            document.getElementById('model-tab-codex')?.classList.remove('active');
            this.addMessage("System", "Engine switched to <strong>General Analysis</strong>.");
        } else if (type === 'codex') {
            AI_CONFIG.currentModel = AI_CONFIG.codexModel;
            document.getElementById('model-tab-lang')?.classList.remove('active');
            document.getElementById('model-tab-codex')?.classList.add('active');
            this.addMessage("System", "Engine switched to <strong>CODEX (Elite Coding)</strong>.");
        }
    },

    clearChat() {
        const container = document.getElementById('ai-messages');
        container.innerHTML = '';
        this.messageHistory = []; // Reset history
        this.addMessage("AI", "Chat history cleared. Context window has been reset. How can I help you now?");
    },

    quickAction(action) {
        const input = document.getElementById('ai-input');
        if (action === "Scan Me") {
            const user = document.getElementById('api-username').value || "your account";
            input.value = `Scan account ${user}`;
        } else if (action === "Analyze Market") {
            input.value = "Briefly analyze the current market for me.";
        } else if (action === "Explain Rates") {
            input.value = "How are USD values calculated for Gold/ETT/Robux?";
        }
        this.sendMessage();
    },

    addMessage(sender, text) {
        const container = document.getElementById('ai-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-bubble ${sender === "AI" ? "bubble-ai" : "bubble-user"}`;
        
        // Update history (internal representation for context window)
        if (sender !== "System") {
            this.messageHistory.push({ role: sender === "AI" ? "assistant" : "user", content: text });
            if (this.messageHistory.length > this.maxHistory) {
                this.messageHistory.shift(); 
            }
        }

        if (sender === "AI") {
            msgDiv.innerHTML = `<span class="bubble-label label-ai">EverythingTT-v1-preview</span><div class="ai-response-container"></div>`;
            container.appendChild(msgDiv);
            const responseContainer = msgDiv.querySelector('.ai-response-container');
            
            // Handle Thinking Mode vs Normal Mode
            this.handleAIResponse(responseContainer, text);
        } else {
            const formattedText = `<p>${text.replace(/\n/g, '<br>')}</p>`;
            msgDiv.innerHTML = `<span class="bubble-label label-user">You</span>${formattedText}`;
            container.appendChild(msgDiv);
        }
        
        this.scrollToBottom();
    },

    /**
     * Orchestrates the display of AI response, handling thoughts if present
     */
    async handleAIResponse(container, text) {
        const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/i);
        const thoughtText = thoughtMatch ? thoughtMatch[1].trim() : null;
        const responseText = text.replace(/<thought>[\s\S]*?<\/thought>/i, '').trim();

        if (thoughtText) {
            const thoughtContainer = document.createElement('div');
            thoughtContainer.className = 'ai-thought-container';
            const thoughtId = `thought-${Math.random().toString(36).substr(2, 9)}`;
            
            thoughtContainer.innerHTML = `
                <div class="ai-thought-header" onclick="document.getElementById('${thoughtId}').classList.toggle('hidden')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    Analytical Synthesis
                </div>
                <div id="${thoughtId}" class="ai-thought-content"></div>
            `;
            container.appendChild(thoughtContainer);
            const thoughtContent = thoughtContainer.querySelector('.ai-thought-content');
            
            // Stream the thought first
            await this.simulateStreaming(thoughtContent, thoughtText, 15);
            
            // Auto-collapse thought after it's done streaming
            setTimeout(() => {
                thoughtContent.classList.add('hidden');
            }, 1000);
        }

        if (responseText) {
            const finalResponse = document.createElement('div');
            finalResponse.className = 'ai-final-content';
            container.appendChild(finalResponse);
            
            // Stream the final response
            await this.simulateStreaming(finalResponse, responseText, 30);
        }
    },

    /**
     * Simulates a streaming text effect and parses Markdown-lite
     * Returns a promise that resolves when streaming is complete
     */
    simulateStreaming(element, text, speed = 30) {
        return new Promise((resolve) => {
            let i = 0;
            const words = text.split(' ');
            
            const stream = () => {
                if (i < words.length) {
                    const partialText = words.slice(0, i + 1).join(' ');
                    element.innerHTML = this.parseMarkdown(partialText);
                    this.scrollToBottom();
                    i++;
                    setTimeout(() => requestAnimationFrame(stream), speed / 2);
                } else {
                    element.innerHTML = this.parseMarkdown(text);
                    this.scrollToBottom();
                    resolve();
                }
            };
            
            requestAnimationFrame(stream);
        });
    },

    /**
     * Advanced Markdown-lite parser supporting headers, bold, lists, tables, code blocks, and callouts
     */
    parseMarkdown(text) {
        if (!text) return "";
        
        let html = text
            // Escape HTML tags to prevent XSS but keep our specific clinical tags
            .replace(/<(?!\/?thought|(?:\s*span\s+[^>]*)|(?:\s*div\s+[^>]*))/g, '&lt;')
            
            // Callouts (Experimental: > [!INFO])
            .replace(/^> \(!(INFO|WARNING|SUCCESS)\)\n([\s\S]*?)(?=\n\n|\n$|$)/gm, (match, type, content) => {
                const lowerType = type.toLowerCase();
                const icon = type === 'SUCCESS' ? 'check-circle' : type === 'WARNING' ? 'alert-triangle' : 'info';
                return `
                    <div class="ai-callout callout-${lowerType}">
                        <div class="callout-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </div>
                        <div class="callout-content">${content.trim()}</div>
                    </div>`;
            })

            // Tables (Improved)
            .replace(/^\|(.+)\|$/gm, (match, content) => {
                const cells = content.split('|').map(c => `<td>${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            })
            .replace(/(<tr>.+<\/tr>)+/g, match => `<table>${match}</table>`)
            .replace(/<table><tr>((?:<td>.+<\/td>)+)<\/tr>/, (match, content) => {
                const headers = content.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
                return `<table><thead><tr>${headers}</tr></thead><tbody>`;
            })
            
            // Headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            
            // Code Blocks
            .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const id = `code-${Math.random().toString(36).substr(2, 9)}`;
                const showRun = lang === 'js' || lang === 'javascript';
                return `
                    <div class="code-block-wrapper">
                        <pre><code class="language-${lang || 'text'}" id="${id}">${code.trim()}</code>
                            <div class="code-exec-bar">
                                <button class="exec-btn" onclick="AI.copyCode('${id}')">Copy</button>
                                ${showRun ? `<button class="exec-btn" onclick="AI.executeCode('${id}')">Run</button>` : ''}
                            </div>
                        </pre>
                    </div>`;
            })
            
            // Inline Code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Lists
            .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>(?:\s*<li>.*<\/li>)*)/g, '<ul>$&</ul>')
            
            // URLs
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-400 hover:underline">$1</a>')
            
            // Paragraphs
            .split('\n\n').map(p => {
                if (p.trim().startsWith('<') || p.trim().startsWith('<li>')) return p;
                return `<p>${p.trim()}</p>`;
            }).join('');

        return html;
    },

    /**
     * Executes JS code snippets from AI responses
     */
    executeCode(id) {
        const code = document.getElementById(id).innerText;
        try {
            // Create a temporary sandbox-like execution
            const result = eval(code);
            console.log("EverythingTT Code Execution:", result);
            alert("Code executed successfully. Check console for output.");
        } catch (err) {
            console.error("Execution Error:", err);
            alert("Execution Error: " + err.message);
        }
    },

    /**
     * Copy code to clipboard
     */
    copyCode(id) {
        const code = document.getElementById(id).innerText;
        navigator.clipboard.writeText(code);
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast("Code Copied");
        } else {
            console.log("Code copied to clipboard");
        }
    },

    scrollToBottom() {
        const container = document.getElementById('ai-messages');
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'auto' // Use auto for streaming to keep it responsive
        });
    },

    async sendMessage() {
        if (!this.isServerOnline) return;
        if (!AI_CONFIG.customKey) {
            console.error("[EverythingTT] Interaction blocked: No API Key provided.");
            return;
        }

        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text) return;

        // Reset input and focus
        input.value = '';
        input.focus();

        // Add user message to UI and history
        this.addMessage('User', text);
        this.messageHistory.push({ role: 'user', content: text });
        if (this.messageHistory.length > this.maxHistory) this.messageHistory.shift();

        // Show typing indicator
        document.getElementById('ai-typing-indicator')?.classList.remove('hidden');
        this.scrollToBottom();

        try {
            const requestMessages = [
                { role: 'system', content: APPRAISER_SYSTEM_PROMPT },
                ...this.messageHistory
            ];

            const response = await fetch(`${Auth.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-EverythingTT-Key': AI_CONFIG.customKey,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    model: AI_CONFIG.currentModel,
                    messages: requestMessages
                })
            });

            if (!response.ok) {
                if (response.status === 0 || response.status >= 500) {
                    this.isServerOnline = false;
                    document.getElementById('offline-overlay')?.classList.remove('hidden');
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `System Error (${response.status})`);
            }

            const data = await response.json();
            const aiContent = data.choices[0].message.content;

            // Add AI response to UI and history
            this.addMessage('AI', aiContent);
            this.messageHistory.push({ role: 'assistant', content: aiContent });
            if (this.messageHistory.length > this.maxHistory) this.messageHistory.shift();

            // Update UI balance via Auth system
            if (Auth.currentUser) {
                // Fetch latest balance from backend to stay synced
                const balanceRes = await fetch(`${Auth.baseUrl}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ username: Auth.currentUser.username, password: Auth.currentUser.password })
                });
                const balanceData = await balanceRes.json();
                if (balanceData.success) {
                    Auth.currentUser.balance = balanceData.balance;
                    Auth.updateUI();
                }
            }

        } catch (error) {
            console.error("[EverythingTT] Communication Error:", error.message);
            this.addMessage('AI', `> [!WARNING] \n**Clinical Error Detected:** ${error.message}\n\nPlease ensure your clinical link is stable and try again.`);
        } finally {
            document.getElementById('ai-typing-indicator')?.classList.add('hidden');
            this.scrollToBottom();
        }
    },

    /**
     * Adds a URL context card to the UI
     */
    addUrlContextCard(ctx) {
        const container = document.getElementById('ai-messages');
        const card = document.createElement('div');
        card.className = 'url-context-card';
        card.innerHTML = `
            <div class="url-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </div>
            <div class="url-info">
                <div class="url-title">${ctx.title}</div>
                <a href="${ctx.url}" target="_blank" class="url-link">${ctx.url}</a>
            </div>
            <div class="text-[8px] text-slate-500 uppercase font-black">Context Injected</div>
        `;
        container.appendChild(card);
        container.scrollTop = container.scrollHeight;
    }
};
