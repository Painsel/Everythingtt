/**
 * AI CONTROLLER - Territorial Appraiser (Global Version)
 * 
 * This version uses the Hugging Face Inference API to provide a global AI
 * experience for all visitors without requiring local software.
 */

const AI_CONFIG = {
    // Using a reliable, OpenAI-compatible endpoint on Hugging Face
    model: "mistralai/Mistral-7B-Instruct-v0.3", 
    endpoint: "https://api-inference.huggingface.co/v1/chat/completions",
    // NOTE: Replace this with your actual token
    token: "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" 
};

const APPRAISER_SYSTEM_PROMPT = `
You are the Territorial Appraiser AI (Painsel Model).
MARKET RATES: 4100 ETT = $5.99, 1000 Gold = $1.99.
AUCTION RECORD HIGHS: Logo: 2,500 Gold, Role: 15,500 Gold, Emoji: 4,500 Gold, Nitro: 8,500 Gold.
VALUATION: Clan Rank 1-500 ($1.21 - $17.99), Gold Rank 1-500 ($0.23 - $39.99).
MISSION: Analyze account scans and predict market trends for Territorial.io.
Refer to Discord: https://discord.gg/DGTMnG9avc
`;

const AI = {
    isChatOpen: false,

    toggleChat() {
        const modal = document.getElementById('aiChatModal');
        this.isChatOpen = !this.isChatOpen;
        if (this.isChatOpen) {
            modal.classList.remove('hidden-modal');
            if (document.getElementById('ai-messages').children.length === 0) {
                this.addMessage("AI", "Hello! I am your Global AI Analyst. How can I help you with the Territorial market?");
            }
        } else {
            modal.classList.add('hidden-modal');
        }
    },

    addMessage(sender, text) {
        const container = document.getElementById('ai-messages');
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = "1rem";
        msgDiv.style.padding = "0.75rem";
        msgDiv.style.borderRadius = "1rem";
        msgDiv.style.fontSize = "0.8rem";
        
        if (sender === "AI") {
            msgDiv.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
            msgDiv.style.color = "white";
            msgDiv.innerHTML = `<strong>Appraiser AI:</strong><br>${text}`;
        } else {
            msgDiv.style.backgroundColor = "rgba(30, 41, 59, 0.5)";
            msgDiv.style.color = "var(--text-muted)";
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.innerHTML = `<strong>You:</strong><br>${text}`;
        }
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    },

    async sendMessage() {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage("User", text);
        input.value = '';

        try {
            let context = "";
            const currentWorth = document.getElementById('res-val').innerText;
            if (currentWorth !== "$0.00") {
                const user = document.getElementById('res-user').innerText;
                const gold = document.getElementById('res-gold').innerText;
                context = `[Context: Currently analyzing ${user}, Worth ${currentWorth}, Gold ${gold}] `;
            }

            const response = await fetch(AI_CONFIG.endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_CONFIG.token}`
                },
                body: JSON.stringify({
                    model: AI_CONFIG.model,
                    messages: [
                        { role: "system", content: APPRAISER_SYSTEM_PROMPT },
                        { role: "user", content: context + text }
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.choices[0].message.content.trim();
            this.addMessage("AI", aiResponse);

        } catch (err) {
            this.addMessage("AI", "The Global Brain is currently busy or experiencing a connection issue. Error: " + err.message);
            console.error("AI Error:", err);
        }
    }
};
