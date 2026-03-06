from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
import uuid
import secrets
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_FILE = "users.json"

# EverythingTT-v1-preview System Prompt (Synchronized with ai-controller.js)
SYSTEM_PROMPT = """
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
    
    # --- PURGE EXTRA KEYS (Enforce 1 FREE API Key Rule) ---
    modified = False
    for username, profile in db["users"].items():
        if len(profile.get("keys", [])) > 1:
            # Keep only the first key, purge others from global keys map
            kept_key = profile["keys"][0]
            purged_keys = profile["keys"][1:]
            for pk in purged_keys:
                if pk in db["keys"]:
                    del db["keys"][pk]
            profile["keys"] = [kept_key]
            modified = True
    
    if modified:
        save_db(db)
        
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
        "keys": user["keys"]
    })

@app.route('/auth/create-key', methods=['POST'])
def create_key():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = load_db()
    user = db["users"].get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Enforce 1 Key Limit
    if len(user.get("keys", [])) >= 1:
        return jsonify({"error": "Limit Reached: Only 1 FREE API Key allowed per identity."}), 403
    
    # Generate key
    new_key = f"ett_free_{secrets.token_hex(16)}"
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
        "version": "1.0.0-preview",
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
    if user["balance"] <= 0:
        return jsonify({"error": "Insufficient ETT Token balance (Limit: 100/mo)"}), 429
    
    # Deduct 1 token
    user["balance"] -= 1
    save_db(db)
    
    # Proceed with AI request
    data = request.json
    messages = data.get('messages', [])
    
    if not any(m.get('role') == 'system' for m in messages):
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
    
    API_URL = "https://router.huggingface.co/v1/chat/completions"
    token = get_api_token()
    
    if not token:
        return jsonify({"error": "Internal token sync failure"}), 500
    
    try:
        response = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct",
                "messages": messages,
                "max_tokens": 800,
                "temperature": 0.5
            }
        )
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
