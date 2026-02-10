// Roadmap Page Interactivity
const initRoadmap = () => {
    console.log('Roadmap script initialized');
    const cards = document.querySelectorAll('.roadmap-card');
    
    // Add staggered entry animation for cards
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });

    // Special interaction for classified box
    const classifiedBox = document.querySelector('.classified-box');
    if (classifiedBox) {
        classifiedBox.addEventListener('mouseenter', () => {
            const icon = classifiedBox.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-user-secret');
                icon.classList.add('fa-eye');
            }
            classifiedBox.style.borderColor = 'rgba(237, 66, 69, 0.5)';
        });

        classifiedBox.addEventListener('mouseleave', () => {
            const icon = classifiedBox.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-user-secret');
            }
            classifiedBox.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });
    }

    // Add hover effects for list items
    const listItems = document.querySelectorAll('.roadmap-card li');
    listItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateX(5px)';
            item.style.color = '#ffffff';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateX(0)';
            item.style.color = 'var(--text-main)';
        });
        item.style.transition = 'all 0.2s ease';
    });

    // Credits to Gold Calculator Logic
    const creditsInput = document.getElementById('credits-input');
    const goldOutput = document.getElementById('gold-output');
    const calcWarning = document.getElementById('calc-warning');

    if (creditsInput && goldOutput) {
        console.log('Calculator elements found');
        const calculateGold = () => {
            const credits = parseFloat(creditsInput.value) || 0;
            console.log('Calculating gold for credits:', credits);
            
            // Show warning if below 300, but calculate anyway for feedback
            if (credits < 300 && credits > 0) {
                calcWarning.classList.remove('hidden');
            } else {
                calcWarning.classList.add('hidden');
            }

            const gold = credits / 15;
            goldOutput.textContent = gold.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        };

        creditsInput.addEventListener('input', calculateGold);
        creditsInput.addEventListener('change', calculateGold);
        creditsInput.addEventListener('keyup', calculateGold);
        
        // Initial calculation
        calculateGold();
    } else {
        console.error('Calculator elements NOT found:', { creditsInput, goldOutput, calcWarning });
    }
};

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRoadmap);
} else {
    initRoadmap();
}
