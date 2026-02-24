/**
 * Inventory Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Your Inventory</h1>
        <div class="card">
            <p>You have no items yet. Visit the Marketplace!</p>
            <a href="marketplace.html" class="btn btn-secondary mt-1">Go to Shop</a>
        </div>
    `;
});
