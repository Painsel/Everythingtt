/* Global Sidebar Shared Logic */
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const body = document.body;
    
    if (sidebar && sidebarToggle) {
        // Apply BETA tester class if applicable
        try {
            const user = JSON.parse(localStorage.getItem('current_user'));
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
