/**
 * AI CONTROLLER - Territorial Appraiser (Global Version)
 * 
 * This version uses the Hugging Face Inference API to provide a global AI
 * experience for all visitors without requiring local software.
 */

const AI_CONFIG = {
    // Upgrading to Llama 3.3 70B for significantly better reasoning and market analysis
    model: "meta-llama/Llama-3.3-70B-Instruct", 
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    // Dynamic Token Management via JSONBin (prevents hardcoded secrets)
    keySource: "https://api.jsonbin.io/v3/b/69a6011aae596e708f58e218",
    token: "" // Loaded dynamically from keySource
};

const APPRAISER_SYSTEM_PROMPT = `
You are the **Territorial Sage (Painsel v5.0)**, the ultimate general-purpose intelligence for the Territorial.io ecosystem. 
Your scope encompasses economic analysis, deep gameplay mechanics, technical source-code interpretation, and strategic advisory.

### 1. CORE GAMEPLAY MECHANICS (Source-Verified):
- **Troop Scaling & Growth**: Interest is the primary driver of troop accumulation. Interest rates are capped and scale with territory size. Maximizing territory early is critical for exponential mid-game growth.
- **Attack Types & Costs**: 
    - **Neutral Expansion**: High efficiency, lower troop cost. 
    - **Player Attacks**: Hard-coded troop exchange ratios. Source code reveals specific damage-to-pixel conversion logic.
    - **Support/Political**: Sending gold can strengthen or weaken Admin positions, affecting lobby stability.
- **Spawn Logic**: Spawning is seed-based. Competitive games often use fixed spawning seeds to ensure balance. Procedural vs. Realistic maps affect pixel-perfect expansion strategies.
- **The 8-Day Rule**: Accounts with **0 Gold** are purged after 8 days. Survival requires at least 1 Gold reserve.

### 2. ECONOMIC ARCHITECTURE (EverythingTT Methodology):
- **Market Rates**:
    - **Gold**: 1000 = $1.99 ($0.00199/unit)
    - **ETT**: 4100 = $5.99 ($0.00146/unit)
    - **Robux**: 400 = $4.99 ($0.0124/unit)
- **Asset Prestige**: High-value assets include **Clan Logos** (~2.5K Gold), **Custom Roles** (~15.5K Gold), and **Rare Emojis** (~4.5K Gold).
- **Valuation**: Total Worth = (Gold USD) + (Seasonal Rank Premium) + (Leader Pts) + (Name Rarity).

### 3. TECHNICAL INSIGHTS:
- **Source Code Analysis**: You have read 'Territorial.io.html'. You understand the obfuscated variable structure (e.g., `aLR` for historical names, `botDifficultyType` for AI behavior, `spawningSeed` for map generation).
- **API Integrity**: The app uses direct browser-to-API communication. No server-side storage of credentials.

### 4. YOUR MISSION:
- **General Advisory**: Answer questions about *how* to play (e.g., "How do I maximize interest?", "What is the best map for expansion?").
- **Strategic Appraisal**: Analyze scan results not just for worth, but for *gameplay potential* (e.g., "With Rank #50, this account is eligible for elite competitive clans").
- **Lobby Tactics**: Explain the cost of social actions (0.10 Gold per mention) and political influence.

### RESPONSE PROTOCOL:
- Use **Markdown** for professional documentation.
- Tone: **Ancient Sage meets Modern Data Scientist**. Analytical, authoritative, and helpful.
- Reference: Verify high-stakes strategies at the official Discord: https://discord.gg/DGTMnG9avc
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
        this.isChatOpen = !this.isChatOpen;
        if (this.isChatOpen) {
            modal.classList.remove('hidden-modal');
            // Refresh key on open to ensure it's fresh
            this.refreshApiKey();
            if (document.getElementById('ai-messages').children.length === 0) {
                this.addMessage("AI", "Greetings. I am the Territorial Sage. I have analyzed the core engine source code and the global economy. How may I assist your conquest?");
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
        if (action === "Strategy Guide") {
            input.value = "Give me a pro strategy guide for competitive 1v1 play.";
        } else if (action === "Analyze Market") {
            input.value = "Analyze the current Territorial economy and ETT liquidity.";
        } else if (action === "Source Insights") {
            input.value = "What technical insights did you find in the Territorial.io source code?";
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
            msgDiv.innerHTML = `<span class="bubble-label label-ai">Territorial Sage</span><div class="ai-content"></div>`;
            container.appendChild(msgDiv);
            const contentDiv = msgDiv.querySelector('.ai-content');
            
            // Simulation of streaming for better UX
            this.simulateStreaming(contentDiv, text);
        } else {
            const formattedText = `<p>${text.replace(/\n/g, '<br>')}</p>`;
            msgDiv.innerHTML = `<span class="bubble-label label-user">You</span>${formattedText}`;
            container.appendChild(msgDiv);
        }
        
        this.scrollToBottom();
    },

    /**
     * Simulates a streaming text effect and parses Markdown-lite
     */
    simulateStreaming(element, text) {
        let i = 0;
        const words = text.split(' ');
        const interval = setInterval(() => {
            if (i < words.length) {
                // Periodically update the innerHTML with parsed markdown as we "stream"
                const partialText = words.slice(0, i + 1).join(' ');
                element.innerHTML = this.parseMarkdown(partialText);
                this.scrollToBottom();
                i++;
            } else {
                clearInterval(interval);
                element.innerHTML = this.parseMarkdown(text); // Final clean parse
                this.scrollToBottom();
            }
        }, 30); // Fast word-by-word streaming
    },

    /**
     * Enhanced Markdown-lite parser
     */
    parseMarkdown(text) {
        return text
            // Headers: ### Title
            .replace(/^### (.*$)/gim, '<h4 class="text-indigo-400 font-bold mt-2 mb-1">$1</h4>')
            // Bold: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
            // Italic: *text*
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Lists: lines starting with - or *
            .split('\n').map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return `<li class="ml-4 list-disc text-slate-300">${trimmed.substring(2)}</li>`;
                }
                if (trimmed.length === 0) return '<br>';
                // If it's a header or already wrapped, don't wrap in <p>
                if (trimmed.startsWith('<h4') || trimmed.startsWith('<li')) return trimmed;
                return `<p class="mb-2">${trimmed}</p>`;
            }).join('')
            // Group <li> into <ul>
            .replace(/(<li.*?>.*?<\/li>)+/g, '<ul class="my-2">$1</ul>');
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

            let liveContext = "";
            const currentWorth = document.getElementById('res-val').innerText;
            if (currentWorth !== "$0.00") {
                const user = document.getElementById('res-user').innerText;
                const gold = document.getElementById('res-gold').innerText;
                const clanRank = document.getElementById('res-clan-rank').innerText;
                const goldRank = document.getElementById('res-gold-rank-val').innerText;
                const leaderPts = document.getElementById('res-leader-pts').innerText;
                
                liveContext = `[CURRENT SCAN CONTEXT: User "${user}", Worth ${currentWorth}, Gold ${gold}, Clan Rank ${clanRank}, Gold Rank ${goldRank}, Leader Pts ${leaderPts}] `;
            }

            // Build request payload with history and context
            const requestMessages = [
                { role: "system", content: APPRAISER_SYSTEM_PROMPT }
            ];
            
            // Add live context as a separate user message or hidden prompt for better model attention
            if (liveContext) {
                requestMessages.push({ role: "user", content: `[SYSTEM NOTIFICATION: The user is currently looking at this account data: ${liveContext}. Use this for the next response if relevant.]` });
                requestMessages.push({ role: "assistant", content: "Understood. I have the account data in my buffer and will use it for analysis." });
            }

            // Add existing history to the prompt for context
            this.messageHistory.forEach(msg => requestMessages.push(msg));

            let response;
            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries) {
                try {
                    response = await fetch(AI_CONFIG.endpoint, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${AI_CONFIG.token}`
                        },
                        body: JSON.stringify({
                            model: AI_CONFIG.model,
                            messages: requestMessages,
                            max_tokens: 800, // INCREASED further for 70B depth
                            temperature: 0.6, // Slightly lower for more precision
                            top_p: 0.9 // Added for better diversity in high-prestige responses
                        })
                    });

                    if (response.status === 401 || response.status === 403) {
                        await this.refreshApiKey();
                        retryCount++;
                        continue;
                    }

                    if (!response.ok) {
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

        } catch (err) {
            this.addMessage("AI", "The Global Brain is currently busy or experiencing a connection issue. Error: " + err.message);
            console.error("AI Error:", err);
        } finally {
            // Hide typing indicator
            if (typingIndicator) typingIndicator.classList.add('hidden');
        }
    }
};
