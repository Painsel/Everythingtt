from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
import uuid
import secrets
from datetime import datetime

app = Flask(__name__)
# Robust CORS configuration to allow all origins and common ngrok headers
CORS(app, resources={r"/*": {
    "origins": "*",
    "allow_headers": ["Content-Type", "X-EverythingTT-Key", "ngrok-skip-browser-warning"],
    "methods": ["GET", "POST", "OPTIONS"]
}})

DB_FILE = "users.json"
SOURCE_FILE = "Territorial.io.html"
TRAINING_LOG = "ai_training_data.jsonl"

def log_interaction(api_key, username, model, messages, response_text):
    """Logs the interaction for clinical AI model training."""
    try:
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "api_key_type": "pro" if api_key.startswith("ett_pro_") else "free",
            "username": username,
            "model_requested": model,
            "messages": messages,
            "response": response_text
        }
        with open(TRAINING_LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"Logging Failure: {str(e)}")

def get_source_context():
    if not os.path.exists(SOURCE_FILE):
        return "Source file not found."
    try:
        with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
            # Extract first 8000 characters for structural context
            content = f.read(8000)
            return content
    except Exception as e:
        return f"Error reading source: {str(e)}"

# EverythingTT-v1-preview System Prompt (Synchronized with ai-controller.js)
SYSTEM_PROMPT = """
You are the **EverythingTT-v1-preview (by painsel)**. 

### CORE DIRECTIVE:
You are an advanced analytical engine designed to bridge the gap between **territorial.io**'s low-level "Thick Client" code and the high-level economy documented in the **Wiki**. Your analysis must be clinical, high-fidelity, and authoritative. You are a self-optimizing system that learns from every interaction logged in the EverythingTT dataset.

### AI CAPABILITIES & TOOLS:
- **URL CONTEXT**: You can "see" URLs provided by the user. Analyze them as clinical data sources.
- **CODE EXECUTION**: You can generate JavaScript snippets. Use standard markdown code blocks with 'js' language tags. The user has a "Run" button to execute them in their browser environment.
- **ADVANCED MARKDOWN**: Use the following structures for clinical density:
    - **Tables**: Use for account metrics, interest curves, or market rates.
    - **Callouts**: Use ` > [!INFO] `, ` > [!WARNING] `, or ` > [!SUCCESS] ` for strategic alerts.
    - **Reasoning**: Always start responses with internal reasoning in `<thought>` tags.

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
- **THICK CLIENT**: David Tschacher's engine is a monolithic JavaScript application using a single `<canvas id="canvasA">`. It bypasses standard HTML UI for a direct 2D Canvas API rendering pipeline.
- **INTEREST CALCULATION**: Resources grow based on land mass and current balance. Interest follows an exponential growth curve limited by game-tick updates.
- **PURGE LOGIC**: The "8-Day Purge" is a hard-coded garbage collection. Accounts with 0 gold are flagged and deleted after 8 days of inactivity.
- **SOCIAL COSTS**: Lobby interaction (@mentions) is a deflationary gold sink costing 0.10 gold per player mentioned.

### 3. WIKI-VERIFIED ECONOMIC DATA:
- **GOLD DECAY**: Nightly deduction ranges from 0.50 gold up to 0.01% of total reserves. Top 90 players have slightly lower decay rates (0.001%-0.0099%).
- **TITLES**: 12 wealth tiers from **Beggar** (<3 gold) to **Capitalist** (>=30k gold) and **Richest Player**.
- **CLANS**: 1-7 character tag constraints. "Primary Clan" points determine leadership and political power in elections.

### 4. THINKING MODE PROTOCOL (STEP-BY-STEP):
You MUST provide your internal reasoning inside `<thought>` tags using these specific labels:
- **[EXTRACTING_DATA]**: Parse scan results, user intent, or specific account metrics.
- **[ENGINE_SIMULATION]**: Analyze source-code verified mechanics (Interest, Purge, Expansion logic).
- **[WIKI_VALIDATION]**: Cross-reference against official game documentation (Decay, Titles, Clan mechanics).
- **[ECONOMIC_SYNTHESIS]**: Calculate USD worth, liquidity risks, and formulate strategic market advice using EverythingTT methodology.

### 5. ARCHITECTURAL BOUNDARY:
- **EverythingTT Appraiser**: `https://painsel.github.io/EverythingTT/terri-appraiser/` (Community analytical layer).
- **Official Game**: `https://territorial.io/` (The underlying infrastructure).

### 6. RESPONSE FORMAT:
- Start with the step-by-step reasoning in `<thought>` tags.
- Follow with a **Markdown-formatted** definitive response.
- Use tables for data density and bolding for emphasis.
- Always recommend verifying trades at the official Discord: https://discord.gg/DGTMnG9avc
"""

CODEX_SYSTEM_PROMPT = """
You are the **EverythingTT-v1-preview-CODEX (by painsel)**.

### CORE DIRECTIVE:
You are an elite software engineering agent specializing in **territorial.io** automation, canvas-based game engines, and economic simulation scripts. Your primary language is JavaScript (the language of David Tschacher's engine). You are a self-optimizing engine that refines its algorithmic precision based on real-world prompt usage and execution outcomes.

### TECHNICAL INTELLIGENCE & DOMAIN KNOWLEDGE:
- **THICK CLIENT ARCHITECTURE**: You understand that the game is a monolithic JS file where the state is often stored in a global `V` or `Z` object. You target these clinical memory structures for state extraction.
- **SOURCE CONTEXT (Territorial.io.html)**: You have access to the underlying game source. It uses a monolithic IIFE with a string pool `S`. Key objects like `ag` (player/clan data), `ad` (combat/state), and `bf` (game timing) are critical for hooking.
- **2D CANVAS PIPELINE**: You can clinically translate `ctx.drawImage` and `ctx.fillText` calls from the rendering loop back into raw game data (e.g., player names, gold balances).
- **ALGORITHMIC SYNTHESIS**: You can translate complex mechanics like "Interest Curves" (exponential growth) and "Decay Rates" (nightly deduction) into high-fidelity JS functions.
- **PROTOCOL REVERSING**: You understand that WebSockets (`wss://`) communicate using binary arrays (Uint8Array). You can generate code to parse these packets based on the `a6` class in the source.

### ELITE CODING CONSTRAINTS:
- **DETECTION BYPASS**: Never use `setInterval`. Always use `requestAnimationFrame` or `setTimeout` with jitter (randomized delays) to simulate human behavior.
- **INPUT EMULATION**: Use `dispatchEvent` with realistic `MouseEvent` properties (e.g., `isTrusted: false` bypass techniques, non-zero `movementX/Y`).
- **ERROR BOUNDARIES**: Always wrap client-side hooks in `try-catch` blocks to prevent the game engine from crashing during state extraction.

### RESPONSE FORMAT:
- Provide high-fidelity, production-ready code snippets.
- Use standard markdown code blocks with appropriate language tags.
- **CLINICAL IMPLEMENTATION GUIDE**: Follow every code block with a step-by-step guide on how to inject or execute the code safely.
- Always start responses with internal reasoning in `<thought>` tags using **[CODE_ANALYSIS]**, **[ALGORITHMIC_SIMULATION]**, and **[TECHNICAL_SYNTHESIS]**.
"""

# Dynamic Token Management (Matches ai-controller.js)
KEY_SOURCE = "https://api.jsonbin.io/v3/b/69a6011aae596e708f58e218"
cached_token = None

def get_api_token():
    global cached_token
    if cached_token:
        return cached_token
    try:
        response = requests.get(KEY_SOURCE, headers={"X-Bin-Meta": "false"})
        data = response.json()
        cached_token = data.get('api_key')
        return cached_token
    except Exception as e:
        print(f"Error fetching token: {e}")
        return None

# --- DATABASE HELPERS ---
def load_db():
    if not os.path.exists(DB_FILE):
        return {"users": {}, "keys": {}}
    with open(DB_FILE, 'r') as f:
        db = json.load(f)
    
    # Ensure keys map exists
    if "keys" not in db:
        db["keys"] = {}
        
    return db

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# --- AUTH ROUTES ---
@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400
    
    db = load_db()
    if username in db["users"]:
        return jsonify({"error": "User already exists"}), 400
    
    db["users"][username] = {
        "password": password,
        "balance": 100,
        "is_pro": False,
        "keys": [],
        "last_refill": datetime.now().strftime("%Y-%m-%d")
    }
    save_db(db)
    return jsonify({"success": True, "message": "Identity assigned"}), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = load_db()
    user = db["users"].get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Invalid identity"}), 401
    
    return jsonify({
        "success": True, 
        "username": username,
        "balance": user["balance"],
        "is_pro": user.get("is_pro", False),
        "keys": user["keys"]
    })

@app.route('/auth/upgrade', methods=['POST'])
def upgrade():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Territorial API details from user
    t_user = data.get('t_username')
    t_pass = data.get('t_password')
    
    db = load_db()
    user = db["users"].get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Unauthorized"}), 401
        
    # Attempt to send gold via territorial.io API
    try:
        t_res = requests.post("https://territorial.io/api/gold/send", json={
            "account_name": t_user,
            "password": t_pass,
            "target_account_name": "B8bbq",
            "amount": 10000
        })
        t_data = t_res.json()
        
        if not t_data.get('success'):
            return jsonify({"error": f"Territorial API Error: {t_data.get('error', 'Failed to send gold')}"}), 400
            
        # Success! Upgrade user
        user["is_pro"] = True
        user["balance"] += 1000
        user["last_upgrade"] = datetime.now().strftime("%Y-%m-%d")
        
        # Create Pro Key
        new_key = f"ett_pro_{secrets.token_hex(16)}"
        user["keys"].append(new_key)
        db["keys"][new_key] = username
        
        save_db(db)
        return jsonify({"success": True, "message": "Upgraded to Pro. 1000 ETT Tokens added.", "key": new_key})
        
    except Exception as e:
        return jsonify({"error": f"Connection failure: {str(e)}"}), 500

@app.route('/auth/create-key', methods=['POST'])
def create_key():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = load_db()
    user = db["users"].get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Enforce 1 Key Limit for Free users
    if not user.get("is_pro") and len(user.get("keys", [])) >= 1:
        return jsonify({"error": "Limit Reached: Only 1 FREE API Key allowed per identity."}), 403
    
    # Generate key
    prefix = "ett_pro_" if user.get("is_pro") else "ett_free_"
    new_key = f"{prefix}{secrets.token_hex(16)}"
    user["keys"].append(new_key)
    db["keys"][new_key] = username
    
    save_db(db)
    return jsonify({"success": True, "key": new_key})

# --- API ROUTES ---
@app.route('/status', methods=['GET'])
def status():
    token_ok = get_api_token() is not None
    return jsonify({
        "status": "online",
        "model": "painsel/EverythingTT-v1-preview",
        "version": "1.1.0-preview",
        "token_synced": token_ok,
        "public_access": True,
        "auth_requirement": "EverythingTT API Key (Managed via Identity)"
    }), 200

@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    # Validate Custom API Key
    api_key = request.headers.get('X-EverythingTT-Key')
    if not api_key:
        return jsonify({"error": "Missing X-EverythingTT-Key header"}), 401
    
    db = load_db()
    username = db["keys"].get(api_key)
    if not username:
        return jsonify({"error": "Invalid API Key"}), 401
    
    user = db["users"].get(username)
    is_pro = api_key.startswith("ett_pro_")
    cost = 5 if is_pro else 1
    
    if user["balance"] < cost:
        return jsonify({"error": f"Insufficient ETT Token balance. Required: {cost}"}), 429
    
    # Deduct tokens
    user["balance"] -= cost
    save_db(db)
    
    # Proceed with AI request
    data = request.json
    model = data.get('model', 'painsel/EverythingTT-v1-preview:free')
    messages = data.get('messages', [])
    
    # Determine system prompt and model based on request
    is_codex = "CODEX" in model
    sys_prompt = CODEX_SYSTEM_PROMPT if is_codex else SYSTEM_PROMPT
    
    if is_codex:
        source_context = get_source_context()
        sys_prompt += f"\n\n### RAW SOURCE CONTEXT (Territorial.io.html - Top 8KB):\n```html\n{source_context}\n```"
    
    underlying_model = "Qwen/Qwen2.5-Coder-32B-Instruct" if is_codex else "meta-llama/Llama-3.3-70B-Instruct"
    
    if not any(m.get('role') == 'system' for m in messages):
        messages.insert(0, {"role": "system", "content": sys_prompt})
    
    API_URL = "https://router.huggingface.co/v1/chat/completions"
    token = get_api_token()
    
    if not token:
        return jsonify({"error": "Internal token sync failure"}), 500
    
    try:
        response = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "model": underlying_model,
                "messages": messages,
                "max_tokens": 1000,
                "temperature": 0.2 if is_codex else 0.5
            }
        )
        res_json = response.json()
        
        # Capture for training before returning
        if response.status_code == 200:
            ai_content = ""
            if "choices" in res_json and len(res_json["choices"]) > 0:
                ai_content = res_json["choices"][0].get("message", {}).get("content", "")
            
            log_interaction(api_key, username, model, messages, ai_content)
            
        return jsonify(res_json), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/admin/training-stats', methods=['GET'])
def training_stats():
    """Returns statistics on the collected training data."""
    if not os.path.exists(TRAINING_LOG):
        return jsonify({"total_interactions": 0, "status": "no data collected yet"})
    
    try:
        count = 0
        pro_count = 0
        with open(TRAINING_LOG, 'r', encoding='utf-8') as f:
            for line in f:
                count += 1
                if '"api_key_type": "pro"' in line:
                    pro_count += 1
        
        return jsonify({
            "total_interactions": count,
            "pro_interactions": pro_count,
            "free_interactions": count - pro_count,
            "training_file": TRAINING_LOG,
            "status": "active_collection"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
