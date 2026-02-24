/**
 * Marketplace Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Marketplace</h1>
        <div class="grid">
            <div class="card">
                <h3>Discord Nitro</h3>
                <p>1 Month Subscription</p>
                <p class="eco-stat">Price: 500 Gold</p>
                <button class="btn btn-primary mt-1">Buy Now</button>
            </div>
            <div class="card">
                <h3>Amazon Giftcard ($10)</h3>
                <p>Code delivered instantly</p>
                <p class="eco-stat">Price: 1200 Gold</p>
                <button class="btn btn-primary mt-1">Buy Now</button>
            </div>
        </div>
    `;
});
