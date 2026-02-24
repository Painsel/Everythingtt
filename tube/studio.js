/**
 * Tube Studio Entry Point
 */
import Auth from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    const container = document.querySelector('main');
    container.innerHTML = `
        <h1>Channel Dashboard</h1>
        
        <div class="card mb-2">
            <h3>Upload New Video</h3>
            <div style="border: 2px dashed #444; padding: 2rem; text-align: center; cursor: pointer;">
                <p>Drag and drop video files to upload</p>
                <button class="btn btn-primary mt-1">Select Files</button>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>Analytics</h3>
                <p>Views: 10,432 (+12%)</p>
                <p>Subscribers: 1,205 (+5)</p>
                <p>Revenue: 50 Gold</p>
            </div>
            <div class="card">
                <h3>Recent Comments</h3>
                <p>"Great video!" - User123</p>
                <p>"First!" - Troll99</p>
            </div>
        </div>
    `;
});
