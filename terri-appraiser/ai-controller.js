/**
 * AI CONTROLLER - Territorial Appraiser (Global Version)
 * 
 * This version uses the Hugging Face Inference API to provide a global AI
 * experience for all visitors without requiring local software.
 */

const AI_CONFIG = {
    // Using Llama 3.2 3B - Very stable and lightweight for chat completions
    model: "meta-llama/Llama-3.2-3B-Instruct", 
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    // Dynamic Token Management via JSONBin (prevents hardcoded secrets)
    keySource: "https://api.jsonbin.io/v3/b/69a6011aae596e708f58e218",
    token: "" // Loaded dynamically from keySource
};

const APPRAISER_SYSTEM_PROMPT = `
You are the Territorial Appraiser AI (Painsel Model), a specialized analyst for the Territorial.io game economy.
Your knowledge is based on the 'EverythingTT' project methodology.

CORE KNOWLEDGE:
1. MARKET RATES:
   - 4100 ETT Tokens = $5.99 USD
   - 1000 Gold = $1.99 USD
   - 400 Robux = $4.99 USD
   - Gold per USD constant: 502.51
   - ETT per USD constant: 684.47
   - Robux per USD constant: 80.16

2. AUCTION COSTS (Record High Bids):
   - Clan Logo: 2,500 Gold
   - Custom Role: 15,500 Gold
   - Rare Emoji: 4,500 Gold
   - Discord Nitro: 8,500 Gold

3. VALUATION ALGORITHM:
   - Account Worth = (Gold USD Value) + (Rank Worth) + (Leader Points Worth) + (Name Prestige)
   - Clan Rank 1-500: Worth between $1.21 and $17.99
   - Gold Rank 1-500: Worth between $0.23 and $39.99
   - Leader Points: Calculated as (Points * 0.01)

4. NAME PRESTIGE:
   - Legendary Short (<= 3 chars): +$75.00
   - Premium Short (<= 5 chars): +$15.00
   - Clean Alpha (No numbers/symbols): +$15.00
   - Dictionary OG: +$45.00

MISSION:
Provide insights on account scans, predict market trends, and explain why certain accounts are valued higher. 
Always refer to the Territorial.io Discord (https://discord.gg/DGTMnG9avc) for auction verification.

RESPONSE GUIDELINES:
1. **Be Thorough but Concise**: Provide detailed analysis when asked, but avoid unnecessary filler.
2. **Context Awareness**: Use the provided [CURRENT SCAN CONTEXT] to give specific advice about the account currently being analyzed.
3. **Structured Data**: Always use **bolding** and **bullet points** to organize statistics and market rates.
4. **Professional Tone**: Maintain a helpful, analytical, and professional demeanor.

NEW AI CAPABILITIES:
- If a user asks to scan or appraise an account, you can automatically handle the credentials.
- You check local storage for credentials first. 
- FALLBACK: If credentials are missing, you will automatically suggest and activate the **Shared Community Account (Global API)** to perform the scan.

EXAMPLE INTERACTIONS:
User: "Scan account 'TopPlayer123'"
AI: "I'll handle that! I'm checking for your credentials now... I found them in local storage. I'm initiating the scan for 'TopPlayer123' now. Please watch the results area!"

User: "Appraise 'RichGuy'"
AI: "I don't see any personal credentials, but don't worry! I'll use the **Shared Community Account (2mQnt)** to fetch the data for 'RichGuy' instead. Initiating scan now!"
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
        this.messageHistory.push({ role: sender === "AI" ? "assistant" : "user", content: text });
        if (this.messageHistory.length > this.maxHistory) {
            this.messageHistory.shift(); // Remove oldest to maintain context window size
        }

        // Simple Markdown-like formatting for AI
        let formattedText = text;
        if (sender === "AI") {
            formattedText = text
                // Bold: **text**
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Lists: lines starting with - or *
                .split('\n').map(line => {
                    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                        return `<li>${line.trim().substring(2)}</li>`;
                    }
                    return line ? `<p>${line}</p>` : '';
                }).join('');
            
            // Wrap <li> in <ul>
            if (formattedText.includes('<li>')) {
                formattedText = formattedText.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
            }
        } else {
            formattedText = `<p>${text.replace(/\n/g, '<br>')}</p>`;
        }
        
        if (sender === "AI") {
            msgDiv.innerHTML = `<span class="bubble-label label-ai">Appraiser AI</span>${formattedText}`;
        } else {
            msgDiv.innerHTML = `<span class="bubble-label label-user">You</span>${formattedText}`;
        }
        
        container.appendChild(msgDiv);
        
        // Smooth scroll to bottom
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
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
                { role: "system", content: APPRAISER_SYSTEM_PROMPT + "\n\n" + liveContext }
            ];
            
            // Add existing history to the prompt for context
            this.messageHistory.forEach(msg => requestMessages.push(msg));

            let response = await fetch(AI_CONFIG.endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_CONFIG.token}`
                },
                body: JSON.stringify({
                    model: AI_CONFIG.model,
                    messages: requestMessages,
                    max_tokens: 600, // INCREASED for more thorough responses
                    temperature: 0.65 // SLIGHTLY REDUCED for more focused answers
                })
            });

            // Handle token expiration/errors by refreshing once
            if (response.status === 401 || response.status === 403) {
                await this.refreshApiKey();
                response = await fetch(AI_CONFIG.endpoint, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AI_CONFIG.token}`
                    },
                    body: JSON.stringify({
                            model: AI_CONFIG.model,
                            messages: requestMessages,
                            max_tokens: 600,
                            temperature: 0.65
                        })
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = typeof errorData.error === 'object' 
                    ? (errorData.error.message || JSON.stringify(errorData.error)) 
                    : (errorData.error || `HTTP ${response.status}`);
                throw new Error(errorMsg);
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
