/**
 * Economy Dashboard Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    
    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Economy Dashboard</h1>
        <div class="grid">
            <div class="card">
                <h3>🎰 Casino</h3>
                <p>Play Blackjack, PushToWin, and gamble your Gold!</p>
                <a href="casino.html" class="btn btn-primary mt-1">Enter Casino</a>
            </div>
            <div class="card">
                <h3>🛍️ Marketplace</h3>
                <p>Buy Nitro, Giftcards, and exclusive items.</p>
                <a href="marketplace.html" class="btn btn-secondary mt-1">Shop Now</a>
            </div>
            <div class="card">
                <h3>🎒 Inventory</h3>
                <p>Manage your assets and trade with others.</p>
                <a href="inventory.html" class="btn btn-primary mt-1">View Inventory</a>
            </div>
        </div>

        <h2 class="mt-2">Top Accounts</h2>
        <div id="top-accounts-list">
            <div class="card mt-1">
                <div class="eco-stat"><span>Player 1</span> <span>10,000 Gold</span></div>
                <div class="eco-stat"><span>Player 2</span> <span>8,500 Gold</span></div>
            </div>
        </div>
    `;
});
