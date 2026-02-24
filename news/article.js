/**
 * Article Viewer Entry Point
 */
import Auth from '../js/auth.js';
import API from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('id');
    
    if (!slug) {
        container.innerHTML = `<h1>Article Not Found</h1>`;
        return;
    }

    container.innerHTML = `<h2>Loading Article...</h2>`;

    // Fetch Article from DB
    const article = await API.get(`/db/read?type=article&id=${slug}`);

    if (article) {
        container.innerHTML = `
            <article class="card">
                <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${article.title}</h1>
                <div class="mb-2" style="color: #aaa; font-size: 0.9rem;">
                    <span>By ${article.author}</span> • <span>${new Date(article.date).toLocaleDateString()}</span>
                </div>
                <div class="article-content" style="font-size: 1.1rem; line-height: 1.8;">
                    ${article.content}
                </div>
            </article>
        `;
    } else {
        container.innerHTML = `<h1>Article Not Found</h1>`;
    }
});
