/**
 * Settings Script - Notification Sounds Management
 */

document.addEventListener('DOMContentLoaded', async () => {
    const soundsContainer = document.getElementById('sounds-list-container');
    const currentSoundDisplay = document.getElementById('current-sound-name');
    let currentAudio = null;

    // Load current notification sound preference
    const savedSound = localStorage.getItem('notification_sound');
    if (savedSound) {
        try {
            const soundObj = JSON.parse(savedSound);
            currentSoundDisplay.textContent = soundObj.name || 'Default';
        } catch (e) {
            currentSoundDisplay.textContent = 'Default';
        }
    }

    // Initialize Notification Sounds
    async function loadSounds() {
        try {
            const sounds = await GitHubAPI.listNotificationSounds();
            
            if (!sounds || sounds.length === 0) {
                soundsContainer.innerHTML = '<div class="error-msg">No notification sounds found.</div>';
                return;
            }

            soundsContainer.innerHTML = ''; // Clear loading state

            sounds.forEach(sound => {
                const soundCard = createSoundCard(sound);
                soundsContainer.appendChild(soundCard);
            });

            // Mark active sound
            updateActiveState();

        } catch (error) {
            console.error('Error loading sounds:', error);
            soundsContainer.innerHTML = '<div class="error-msg">Failed to load sounds. Please try again.</div>';
        }
    }

    function createSoundCard(sound) {
        const div = document.createElement('div');
        div.className = 'sound-item';
        div.dataset.soundName = sound.name;
        
        div.innerHTML = `
            <div class="sound-info">
                <span class="sound-name">${sound.name.replace(/\.[^/.]+$/, "")}</span>
                <button class="btn-play-sound" title="Preview Sound">
                    <i class="fas fa-play"></i>
                </button>
            </div>
            <button class="btn-set-sound">Set as notification sound</button>
        `;

        const playBtn = div.querySelector('.btn-play-sound');
        const setBtn = div.querySelector('.btn-set-sound');

        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay(sound, playBtn);
        });

        setBtn.addEventListener('click', () => {
            setNotificationSound(sound);
        });

        return div;
    }

    function togglePlay(sound, btn) {
        const icon = btn.querySelector('i');
        
        // If already playing this sound, stop it
        if (currentAudio && currentAudio.src === sound.url) {
            if (!currentAudio.paused) {
                currentAudio.pause();
                icon.className = 'fas fa-play';
                return;
            }
        }

        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            document.querySelectorAll('.btn-play-sound i').forEach(i => i.className = 'fas fa-play');
        }

        // Play new sound
        currentAudio = new Audio(sound.url);
        icon.className = 'fas fa-spinner fa-spin';
        
        currentAudio.play().then(() => {
            icon.className = 'fas fa-pause';
        }).catch(err => {
            console.error('Playback failed:', err);
            icon.className = 'fas fa-play';
        });

        currentAudio.onended = () => {
            icon.className = 'fas fa-play';
        };
    }

    function setNotificationSound(sound) {
        localStorage.setItem('notification_sound', JSON.stringify({
            name: sound.name,
            url: sound.url
        }));
        
        currentSoundDisplay.textContent = sound.name.replace(/\.[^/.]+$/, "");
        updateActiveState();
        
        // Show feedback (optional toast could be added here)
        const activeCard = document.querySelector(`.sound-item[data-sound-name="${sound.name}"]`);
        if (activeCard) {
            const btn = activeCard.querySelector('.btn-set-sound');
            const originalText = btn.textContent;
            btn.textContent = 'Selected!';
            btn.style.background = '#43b581';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        }
    }

    function updateActiveState() {
        const saved = localStorage.getItem('notification_sound');
        if (!saved) return;

        try {
            const soundObj = JSON.parse(saved);
            document.querySelectorAll('.sound-item').forEach(item => {
                if (item.dataset.soundName === soundObj.name) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        } catch (e) {}
    }

    // Initial load
    loadSounds();
});
