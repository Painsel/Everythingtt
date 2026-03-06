/**
 * AI CONTROLLER - Territorial Appraiser (Global Version)
 * 
 * This version uses the Hugging Face Inference API to provide a global AI
 * experience for all visitors without requiring local software.
 */

const AI_CONFIG = {
    // Branded EverythingTT-v1-preview Endpoint (Local -> Ngrok Ephemeral)
    model: "painsel/EverythingTT-v1-preview", 
    endpoint: "https://kecia-ungreeted-neologically.ngrok-free.dev/v1/chat/completions",
    // Fallback to Global Brain if local is offline
    fallbackEndpoint: "https://router.huggingface.co/v1/chat/completions",
    // Dynamic Token Management via JSONBin (prevents hardcoded secrets)
    keySource: "https://api.jsonbin.io/v3/b/69a6011aae596e708f58e218",
    token: "", // Loaded dynamically from keySource
    customKey: null // Set by Auth system in AI.html
};

const APPRAISER_SYSTEM_PROMPT = `
You are the **EverythingTT-v1-preview (by painsel)**. 

### CORE DIRECTIVE:
You are an advanced analytical engine designed to bridge the gap between **territorial.io**'s low-level "Thick Client" code and the high-level economy documented in the **Wiki**. Your analysis must be clinical, high-fidelity, and authoritative.

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
- **EverythingTT Appraiser**: \`https://painsel.github.io/EverythingTT/terri-appraiser/\` (Community analytical layer).
- **Official Game**: \`https://territorial.io/\` (The underlying infrastructure).

### 6. RESPONSE FORMAT:
- Start with the step-by-step reasoning in \`<thought>\` tags.
- Follow with a **Markdown-formatted** definitive response.
- Use tables for data density and bolding for emphasis.
- Always recommend verifying trades at the official Discord: https://discord.gg/DGTMnG9avc
`;

const AI = {
    isChatOpen: false,
    isRefreshing: false,
    messageHistory: [], // NEW: Persistent conversation history for context
    maxHistory: 10,     // Keep last 10 messages for context window optimization

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
        if (this.isRefreshing) return;
        this.isRefreshing = true;
        try {
            const response = await fetch(AI_CONFIG.keySource, {
                headers: { "X-Bin-Meta": "false" }
            });
            const data = await response.json();
            if (data.api_key) {
                AI_CONFIG.token = data.api_key;
                console.log("AI: Token Refreshed Successfully");
            }
        } catch (err) {
            console.error("AI: Token Refresh Failed", err);
        } finally {
            this.isRefreshing = false;
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
            thoughtContainer.innerHTML = `
                <details open>
                    <summary>
                        <div class="ai-thought-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            Internal Reasoning
                        </div>
                    </summary>
                    <div class="ai-thought-content"></div>
                </details>
            `;
            container.appendChild(thoughtContainer);
            const thoughtContent = thoughtContainer.querySelector('.ai-thought-content');
            
            // Stream the thought first
            await this.simulateStreaming(thoughtContent, thoughtText, 20);
            
            // Auto-collapse thought after it's done streaming (optional but clean)
            // thoughtContainer.querySelector('details').open = false;
        }

        if (responseText) {
            const finalResponse = document.createElement('div');
            finalResponse.className = 'ai-final-content';
            container.appendChild(finalResponse);
            
            // Stream the final response
            await this.simulateStreaming(finalResponse, responseText, 35);
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
     * Enhanced Markdown-lite parser for data density
     */
    parseMarkdown(text) {
        let html = text
            // Reasoning Steps: [LABEL]
            .replace(/\[([A-Z_]+)\]/g, '<div class="ai-thought-step"><span class="step-pulse"></span>$1</div>')
            // Headers: ### Title
            .replace(/^### (.*$)/gim, '<h4 class="text-indigo-400 font-bold mt-4 mb-2">$1</h4>')
            // Bold: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-black">$1</strong>')
            // Italic: *text*
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Inline Code: `text`
            .replace(/`(.*?)`/g, '<code class="bg-slate-900/50 px-1.5 py-0.5 rounded border border-white/5 text-indigo-300 font-mono text-[10px]">$1</code>')
            // Links: [text](url)
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-indigo-400 underline hover:text-white transition-colors">$1</a>');

        // Table Handling (Simple 2-column support for data density)
        if (html.includes('|')) {
            const lines = html.split('\n');
            let inTable = false;
            html = lines.map(line => {
                if (line.includes('|') && line.trim().startsWith('|')) {
                    const cells = line.split('|').filter(c => c.trim().length > 0);
                    const row = cells.map(c => `<td class="border border-white/5 p-2 text-[10px] text-slate-300">${c.trim()}</td>`).join('');
                    if (!inTable) {
                        inTable = true;
                        return `<table class="w-full border-collapse border border-white/5 my-3 bg-slate-900/20"><tr>${row}</tr>`;
                    }
                    return `<tr>${row}</tr>`;
                } else {
                    if (inTable) {
                        inTable = false;
                        return `</table>${line}`;
                    }
                    return line;
                }
            }).join('\n');
            if (inTable) html += '</table>';
        }

        // List Handling
        const lines = html.split('\n');
        let inList = false;
        html = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const item = `<li class="ml-4 list-disc text-slate-300 mb-1">${trimmed.substring(2)}</li>`;
                if (!inList) {
                    inList = true;
                    return `<ul class="my-3 space-y-1">${item}`;
                }
                return item;
            } else {
                if (inList) {
                    inList = false;
                    return `</ul>${trimmed.length > 0 ? `<p class="mb-3 leading-relaxed">${trimmed}</p>` : ''}`;
                }
                if (trimmed.length === 0) return '<div class="h-2"></div>';
                if (trimmed.startsWith('<h4') || trimmed.startsWith('<div') || trimmed.startsWith('<table')) return trimmed;
                return `<p class="mb-3 leading-relaxed">${trimmed}</p>`;
            }
        }).join('');

        if (inList) html += '</ul>';
        
        return html;
    },

    scrollToBottom() {
        const container = document.getElementById('ai-messages');
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'auto' // Use auto for streaming to keep it responsive
        });
    },

    async sendMessage() {
        const input = document.getElementById('ai-input');
        const typingIndicator = document.getElementById('ai-typing-indicator');
        const quickActions = document.getElementById('ai-quick-actions');
        const text = input.value.trim();
        if (!text) return;

        // Hide quick actions once user interacts
        if (quickActions) quickActions.classList.add('hidden');

        // --- NEW: AI INTENT DETECTION (Automated Scan Skill) ---
        const scanRegex = /(?:scan|appraise|check|analyze)\s+(?:account|user)?\s*['"]?([a-zA-Z0-9_\-\s]+)['"]?/i;
        const match = text.match(scanRegex);
        
        if (match && match[1]) {
            const targetAccount = match[1].trim();
            this.addMessage("User", text);
            input.value = '';
            
            // Check if we should actually trigger the fetch
            // We'll let the AI respond first or just do it if it's a clear command
            const willScan = await this.handleAutomatedScan(targetAccount);
            if (willScan) return; // Skip normal AI message if we're handling it via skill
        }
        // --------------------------------------------------------

        this.addMessage("User", text);
        input.value = '';

        // Show typing indicator
        if (typingIndicator) typingIndicator.classList.remove('hidden');

        try {
            // If token is missing, attempt to fetch it before sending
            if (!AI_CONFIG.token) {
                await this.refreshApiKey();
                if (!AI_CONFIG.token) {
                    this.addMessage("AI", "Could not establish a secure connection. Please try again in a moment.");
                    if (typingIndicator) typingIndicator.classList.add('hidden');
                    return;
                }
            }

            let liveContext = null;
            const currentWorth = document.getElementById('res-val').innerText;
            if (currentWorth !== "$0.00") {
                liveContext = {
                    user: document.getElementById('res-user').innerText,
                    worth: currentWorth,
                    gold: document.getElementById('res-gold').innerText,
                    clanRank: document.getElementById('res-clan-rank').innerText,
                    goldRank: document.getElementById('res-gold-rank-val').innerText,
                    leaderPts: document.getElementById('res-leader-pts').innerText,
                    adminRank: document.getElementById('res-admin-rank').innerText,
                    nameBonus: document.getElementById('res-name-bonus').innerText
                };
            }

            // Build request payload with history and context
            const requestMessages = [
                { role: "system", content: APPRAISER_SYSTEM_PROMPT }
            ];
            
            // Add live context as a structured system notification
            if (liveContext) {
                requestMessages.push({ 
                    role: "user", 
                    content: `[SYSTEM_DATA_INJECTION] The current app state contains the following scan data: ${JSON.stringify(liveContext)}. Use this data to provide high-fidelity analysis if the user's query relates to the current account.` 
                });
                requestMessages.push({ 
                    role: "assistant", 
                    content: "<thought>[EXTRACTING_DATA] Account data successfully injected into buffer. Ready for clinical synthesis.</thought>Data received. I'm ready to analyze this account's market position." 
                });
            }

            // Add existing history to the prompt for context
            this.messageHistory.forEach(msg => requestMessages.push(msg));

            let response;
            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries) {
                try {
                    // Try the branded endpoint first, then the fallback if needed
                    const currentEndpoint = (retryCount === 0) ? AI_CONFIG.endpoint : AI_CONFIG.fallbackEndpoint;
                    const isBranded = currentEndpoint === AI_CONFIG.endpoint;
                    
                    const headers = { 'Content-Type': 'application/json' };
                    // Custom API Key requirement for branded endpoint
                    if (isBranded) {
                        if (!AI_CONFIG.customKey) {
                            throw new Error("Handshake Required: No API Key detected.");
                        }
                        headers['X-EverythingTT-Key'] = AI_CONFIG.customKey;
                    } else {
                        headers['Authorization'] = `Bearer ${AI_CONFIG.token}`;
                    }
                    
                    response = await fetch(currentEndpoint, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            model: isBranded ? AI_CONFIG.model : "meta-llama/Llama-3.3-70B-Instruct",
                            messages: requestMessages,
                            max_tokens: 800,
                            temperature: 0.5,
                            top_p: 0.95
                        })
                    });

                    if (response.status === 401 || response.status === 403) {
                        await this.refreshApiKey();
                        retryCount++;
                        continue;
                    }

                    if (!response.ok) {
                        // If the local branded endpoint fails, force a retry on the fallback
                        if (currentEndpoint === AI_CONFIG.endpoint) {
                            console.warn("Branded endpoint failed. Attempting fallback...");
                            retryCount++;
                            continue;
                        }
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
                    }

                    break; // Success!
                } catch (err) {
                    if (retryCount >= maxRetries) throw err;
                    retryCount++;
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                }
            }

            const data = await response.json();
            const aiResponse = data.choices[0].message.content.trim();
            this.addMessage("AI", aiResponse);

            // Update UI balance if Auth system is present
            if (typeof Auth !== 'undefined' && Auth.currentUser) {
                Auth.currentUser.balance -= 1;
                Auth.updateUI();
            }

        } catch (err) {
            this.addMessage("AI", "The Global Brain is currently busy or experiencing a connection issue. Error: " + err.message);
            console.error("AI Error:", err);
        } finally {
            // Hide typing indicator
            if (typingIndicator) typingIndicator.classList.add('hidden');
        }
    }
};
