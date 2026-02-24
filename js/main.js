/**
 * Main Portal Entry Point
 */
import Auth from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();

    // The HTML is already static in index.html, we just needed Auth init
    console.log("EverythingTT Portal Loaded");
});
