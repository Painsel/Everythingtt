// Community Rules Script
document.addEventListener('DOMContentLoaded', () => {
    // Check for logged in user to display coins
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (user && !user.isGuest) {
        const ettCoinsCount = document.getElementById('ett-coins-count');
        if (ettCoinsCount) {
            ettCoinsCount.innerText = (user.ettCoins || 0).toLocaleString();
        }

        // Optional: Sync with remote to get latest coins
        if (window.GitHubAPI) {
            GitHubAPI.syncUserProfile(user.id).then(remoteUser => {
                if (remoteUser && ettCoinsCount) {
                    ettCoinsCount.innerText = (remoteUser.ettCoins || 0).toLocaleString();
                }
            }).catch(err => console.error('Error syncing user profile:', err));
        }
    } else if (user && user.isGuest) {
        // Hide coins for guests if preferred, or keep at 0
        const coinsDisplay = document.querySelector('.global-header-tools');
        if (coinsDisplay) {
            coinsDisplay.style.display = 'none';
        }
    }
});
