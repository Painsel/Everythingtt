/* Global Sidebar Shared Logic */

// Global Notification Function
window.showNotification = function(title, message, type = 'info') {
    let container = document.getElementById('notification-container');
    
    // Create container if it doesn't exist (e.g. on pages other than login)
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };

    notification.innerHTML = `
        <div class="notification-icon">${icons[type] || '🔔'}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;

    container.appendChild(notification);
    
    // Force reflow for animation
    notification.offsetHeight;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 400);
    }, 5000);
};

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const body = document.body;
    
    if (sidebar && sidebarToggle) {
        // Apply BETA tester class if applicable
        try {
            const user = JSON.parse(localStorage.getItem('current_user'));
            if (user && user.isGuest) {
                body.classList.add('is-guest');
                
                // Centralized Guest UI Restrictions
                const restrictedLinks = [
                    'my-articles',
                    'create-article',
                    'profile-editor',
                    'admin-panel'
                ];

                const navItems = document.querySelectorAll('.nav-item');
                navItems.forEach(item => {
                    const href = item.getAttribute('href') || '';
                    if (restrictedLinks.some(link => href.includes(link))) {
                        item.classList.add('restricted-feature');
                        item.style.opacity = '0.5';
                        item.style.pointerEvents = 'none';
                        item.title = 'Login to access this feature';
                    }
                });
            }

            if (window.GitHubAPI && GitHubAPI.isBetaTester(user)) {
                body.classList.add('is-beta-tester');
            }
        } catch (e) {}

        // Function to update body class based on sidebar state
        const updateBodyState = (isCollapsed) => {
            if (isCollapsed) {
                body.classList.remove('sidebar-open');
            } else {
                body.classList.add('sidebar-open');
            }
        };

        // Load persistence state
        const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            updateBodyState(true);
        } else {
            sidebar.classList.remove('collapsed');
            updateBodyState(false);
        }

        sidebarToggle.addEventListener('click', () => {
            const nowCollapsed = sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar_collapsed', nowCollapsed);
            updateBodyState(nowCollapsed);
        });
    }
});
