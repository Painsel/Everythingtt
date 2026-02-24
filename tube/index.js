/**
 * Tube Dashboard Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <div class="search-bar mb-2">
            <input type="text" placeholder="Search videos..." style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid #444; background: #222; color: #fff;">
        </div>

        <h2>Recommended</h2>
        <div class="tube-video-grid mt-1" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem;">
            <div class="card video-card">
                <div style="background: #333; height: 150px; display: flex; align-items: center; justify-content: center; color: #aaa;">Thumbnail</div>
                <h4 class="mt-1">Epic Gaming Moments #42</h4>
                <p style="font-size: 0.9rem; color: #888;">GamerPro • 1.2M views</p>
            </div>
            <div class="card video-card">
                <div style="background: #333; height: 150px; display: flex; align-items: center; justify-content: center; color: #aaa;">Thumbnail</div>
                <h4 class="mt-1">How to Code in 2026</h4>
                <p style="font-size: 0.9rem; color: #888;">DevTips • 500K views</p>
            </div>
        </div>
        
        <div class="mt-2 text-center">
            <a href="studio.html" class="btn btn-primary">Go to Studio</a>
        </div>
    `;
});
