/**
 * Create Article Entry Point
 */
import Auth from '../js/auth.js';
import API from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Write New Article</h1>
        <div class="card">
            <input type="text" id="article-title" placeholder="Article Title" style="width: 100%; padding: 10px; font-size: 1.5rem; margin-bottom: 1rem; background: #333; color: white; border: none;">
            
            <div class="editor-toolbar" style="background: #222; padding: 10px; border-bottom: 1px solid #444; display: flex; gap: 10px;">
                <button class="btn btn-secondary btn-sm">Bold</button>
                <button class="btn btn-secondary btn-sm">Italic</button>
            </div>
            
            <div id="editor-content" class="editor-content" contenteditable="true" style="min-height: 400px; background: #1e1e24; color: #fff; padding: 20px; border: 1px solid #444; outline: none;">
                Start writing your story here...
            </div>
            
            <div class="mt-2 text-center">
                <button id="publish-btn" class="btn btn-primary">Publish Article</button>
            </div>
        </div>
    `;

    document.getElementById('publish-btn').addEventListener('click', async () => {
        const title = document.getElementById('article-title').value;
        const content = document.getElementById('editor-content').innerHTML;
        
        if(!title) return alert('Title required');

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const articleData = {
            id: slug,
            title,
            content,
            date: new Date().toISOString(),
            author: Auth.state.user ? (Auth.state.user.user_metadata.username || Auth.state.user.email) : 'Anonymous'
        };

        const result = await API.securePost('/db/write', {
            type: 'article',
            id: slug,
            data: articleData
        });

        if(result && result.success) {
            alert('Article Published!');
            window.location.href = `article.html?id=${slug}`;
        } else {
            alert('Failed to publish');
        }
    });
});
