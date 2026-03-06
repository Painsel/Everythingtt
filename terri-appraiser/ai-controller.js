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
            .replace(/(<li>.*<\/li>)+/g, '<ul>$0</ul>')
            
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
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        const typingIndicator = document.getElementById('ai-typing-indicator');
        const quickActions = document.getElementById('ai-quick-actions');
        
        if (!text) return;

        // Hide quick actions once user interacts
        if (quickActions) quickActions.classList.add('hidden');

        // --- URL CONTEXT DETECTION ---
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
        let urlContext = null;
        if (urlMatch) {
            const url = urlMatch[0];
            // Simulate fetching metadata (In a real app, this would be a proxy fetch)
            urlContext = {
                url: url,
                title: url.split('/').pop() || url,
                timestamp: new Date().toLocaleTimeString()
            };
            this.addUrlContextCard(urlContext);
        }
        // -----------------------------

        this.addMessage("User", text);
        input.value = '';

        // Show typing indicator
        if (typingIndicator) typingIndicator.classList.remove('hidden');

        try {
            // If token is missing, attempt to fetch it before sending
            if (!AI_CONFIG.token) {
                await this.refreshApiKey();
            }

            let liveContext = null;
            const resValEl = document.getElementById('res-val');
            
            // Only inject context if we are on the main app page with active results
            if (resValEl) {
                const currentWorth = resValEl.innerText;
                if (currentWorth !== "$0.00") {
                    liveContext = {
                        user: document.getElementById('res-user')?.innerText || "---",
                        worth: currentWorth,
                        gold: document.getElementById('res-gold')?.innerText || "0",
                        clanRank: document.getElementById('res-clan-rank')?.innerText || "---",
                        goldRank: document.getElementById('res-gold-rank-val')?.innerText || "---",
                        leaderPts: document.getElementById('res-leader-pts')?.innerText || "0",
                        adminRank: document.getElementById('res-admin-rank')?.innerText || "---",
                        nameBonus: document.getElementById('res-name-bonus')?.innerText || "$0.00"
                    };
                }
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

            // Add URL context if detected
            if (urlContext) {
                requestMessages.push({
                    role: "user",
                    content: `[URL_CONTEXT_INJECTION] The user provided a URL: ${urlContext.url}. Title: ${urlContext.title}. Analyze this resource in the context of the inquiry.`
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
                    
                    const headers = { 
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true' // Bypass ngrok interstitial
                    };
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
        } finally {
            // Hide typing indicator
            if (typingIndicator) typingIndicator.classList.add('hidden');
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
