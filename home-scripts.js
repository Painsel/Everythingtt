document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
    initializeNavigation();
    startLiveStatUpdates();
    animateCharts();
});

function initializeSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (!menuToggle || !sidebar || !mainContent) return;

    const DESKTOP_BREAKPOINT = 768;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        
        if (window.innerWidth > DESKTOP_BREAKPOINT) {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        }
    });
}

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const sidebar = document.getElementById('sidebar');
    const MOBILE_BREAKPOINT = 768;

    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            if (window.innerWidth <= MOBILE_BREAKPOINT && sidebar) {
                sidebar.classList.remove('active');
            }
        });
    });
}

function startLiveStatUpdates() {
    const UPDATE_INTERVAL_MS = 5000;
    setInterval(updateRandomStat, UPDATE_INTERVAL_MS);
}

function updateRandomStat() {
    const stats = document.querySelectorAll('.stat-value');
    if (stats.length === 0) return;

    const randomIndex = Math.floor(Math.random() * stats.length);
    const statElement = stats[randomIndex];
    
    const currentVal = parseStatValue(statElement.innerText);
    const change = generateRandomChange();
    const newVal = currentVal + change;
    
    statElement.innerText = formatStatValue(newVal, statElement.innerText);
}

function parseStatValue(text) {
    return parseInt(text.replace(/[^0-9]/g, ''), 10);
}

function generateRandomChange() {
    return Math.floor(Math.random() * 10) - 5;
}

function formatStatValue(value, originalText) {
    const formattedValue = value.toLocaleString();
    return originalText.includes('$') ? `$${formattedValue}` : formattedValue;
}

function animateCharts() {
    const bars = document.querySelectorAll('.bar');
    const ANIMATION_DELAY_MS = 500;

    bars.forEach(bar => {
        const targetHeight = bar.style.height;
        bar.style.height = '0';
        
        setTimeout(() => {
            bar.style.height = targetHeight;
        }, ANIMATION_DELAY_MS);
    });
}
