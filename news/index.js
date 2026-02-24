/**
 * News Dashboard Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Latest Articles</h1>
        <div class="mb-2">
            <a href="create.html" class="btn btn-primary">Write Article</a>
        </div>
        
        <div class="news-article card">
            <h2 class="mb-1">Why Facts Don't Change Minds</h2>
            <p class="mb-1" style="color:#aaa;">By Painsel • Feb 24, 2026 • Science</p>
            <p>An exploration into cognitive dissonance and why beliefs are so hard to shake...</p>
            <a href="article.html?id=why-facts-dont-change-minds" class="btn btn-secondary mt-1">Read More</a>
        </div>
    `;
});
