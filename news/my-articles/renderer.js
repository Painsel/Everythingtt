// My Articles Specific Renderer Logic
(function() {
    // Set filter to 'my' so article-renderer.js knows to filter by current user
    window.currentFilter = 'my';

    console.log('My Articles renderer initialized');

    // Override the back to feed button behavior if it exists
    const btnBackToFeed = document.getElementById('btn-back-to-feed');
    if (btnBackToFeed) {
        btnBackToFeed.addEventListener('click', () => {
            if (document.body.classList.contains('single-article-view')) {
                window.location.hash = '';
                location.reload(); // Refresh to show the "My Articles" list again
            } else {
                window.location.href = '../articles/';
            }
        });
    }
})();
