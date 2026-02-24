/**
 * Casino Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Welcome to the Casino</h1>
        <div class="casino-table" style="background: #2e7d32; border-radius: 20px; padding: 2rem; margin: 2rem 0; text-align: center; border: 5px solid #1b5e20;">
            <h2>Blackjack Table</h2>
            <div id="dealer-hand">
                <div class="card-slot" style="display:inline-block; width:60px; height:90px; background:white; color:black; border-radius:5px; margin:5px; line-height:90px; font-weight:bold; font-size:1.5rem;">?</div>
                <div class="card-slot" style="display:inline-block; width:60px; height:90px; background:white; color:black; border-radius:5px; margin:5px; line-height:90px; font-weight:bold; font-size:1.5rem;">A♠</div>
            </div>
            <p class="mt-1">Dealer's Hand</p>
            
            <div id="player-hand" class="mt-2">
                <div class="card-slot" style="display:inline-block; width:60px; height:90px; background:white; color:black; border-radius:5px; margin:5px; line-height:90px; font-weight:bold; font-size:1.5rem;">K♥</div>
                <div class="card-slot" style="display:inline-block; width:60px; height:90px; background:white; color:black; border-radius:5px; margin:5px; line-height:90px; font-weight:bold; font-size:1.5rem;">10♦</div>
            </div>
            <p class="mt-1">Your Hand (20)</p>

            <div class="actions mt-2">
                <button class="btn btn-primary">Hit</button>
                <button class="btn btn-secondary">Stand</button>
            </div>
        </div>
        
        <div class="chat-room card mt-2">
            <h3>Casino Chat (Secure)</h3>
            <div id="chat-messages" style="height: 200px; overflow-y: scroll; border: 1px solid #444; padding: 10px; margin-bottom: 10px;">
                <div><strong>System:</strong> Connecting to Supabase Realtime...</div>
            </div>
            <input type="text" placeholder="Type a message..." style="width: 70%; padding: 8px;">
            <button class="btn btn-primary">Send</button>
        </div>
    `;

    // Initialize Realtime Stub
    setTimeout(() => {
        const chat = document.getElementById('chat-messages');
        if(chat) chat.innerHTML += `<div><strong>System:</strong> Connected.</div>`;
    }, 1000);
});
