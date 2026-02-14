/**
 * Settings Script - Notification Sounds Management
 */

document.addEventListener('DOMContentLoaded', async () => {
    let user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../../index.html';
        return;
    }

    // Server-side check: Verify user still exists in storage
    if (!user.isGuest) {
        try {
            GitHubAPI.showPauseModal('Authenticating your session...');
            const verifiedUser = await GitHubAPI.syncUserProfile();
            if (!verifiedUser) {
                console.error('[Security] Account verification failed on load. Redirecting to login.');
                localStorage.removeItem('current_user');
                window.location.href = '../../index.html?error=account_deleted';
                return;
            }
            user = verifiedUser; // Use the fresh data
        } catch (e) {
            console.warn('[Security] Could not verify account server-side. Continuing with cached data.', e);
        } finally {
            GitHubAPI.hidePauseModal();
        }
    }

    // Update UI with current user info
    const updateUI = (u) => {
        const sidePfp = document.getElementById('side-pfp');
        const sideUsername = document.getElementById('side-username');
        const sideStatusIcon = document.getElementById('side-status-icon');
        const sideBubble = document.getElementById('side-status-bubble');

        if (sidePfp) sidePfp.src = u.pfp;
        if (sideUsername) sideUsername.innerText = u.username;

        // Update ETT Coins display
        const ettCoinsCount = document.getElementById('ett-coins-count');
        if (ettCoinsCount) {
            ettCoinsCount.innerText = (u.ettCoins || 0).toLocaleString();
        }

        if (sideStatusIcon) {
            const isGuest = u.isGuest === true;
            const statusIconName = isGuest ? 'Offline.png' : ((u.statusType === 'dnd') ? 'DoNotDisturb.png' : (u.status === 'idle' ? 'Idle.png' : (u.status === 'online' ? 'Online.png' : 'Offline.png')));
            const iconPath = GitHubAPI.getStatusIconPath(statusIconName);
            sideStatusIcon.style.backgroundImage = `url('${iconPath}')`;
        }

        if (sideBubble) {
            if (u.statusMsg) {
                sideBubble.innerText = u.statusMsg;
                sideBubble.style.display = 'block';
            } else {
                sideBubble.style.display = 'none';
            }
        }

        // Update settings page profile preview
        const settingsPfp = document.getElementById('settings-profile-pfp');
        const settingsUsername = document.getElementById('settings-profile-username');
        const settingsId = document.getElementById('settings-profile-id');

        if (settingsPfp) settingsPfp.src = u.pfp;
        if (settingsUsername) settingsUsername.innerText = u.username;
        if (settingsId) settingsId.innerText = u.isGuest ? '@guest' : `@${u.id || u.username.toLowerCase().replace(/\s+/g, '')}`;

        // Add badges to sidebar username row
        if (sideUsername) {
            let sideBadgeContainer = sideUsername.nextElementSibling;
            if (!sideBadgeContainer || !sideBadgeContainer.classList.contains('badge-container')) {
                sideBadgeContainer = document.createElement('div');
                sideBadgeContainer.className = 'badge-container';
                sideBadgeContainer.style.display = 'inline-flex';
                sideBadgeContainer.style.marginLeft = '4px';
                sideBadgeContainer.style.verticalAlign = 'middle';
                sideUsername.parentNode.insertBefore(sideBadgeContainer, sideUsername.nextSibling);
            }

            let badges = '';
            if (u.isGuest) {
                badges = `<span class="user-badge guest-badge" title="Guest User">GUEST</span>`;
            } else {
                badges = `
                    ${GitHubAPI.renderRoleBadge(u.role)}
                    ${GitHubAPI.renderNewUserBadge(u.joinDate, 'user-badge side-badge')}
                    ${GitHubAPI.renderThemeBadge('user-badge side-badge')}
                `;
            }
            sideBadgeContainer.innerHTML = badges;
        }

        // Admin nav item check
        const adminNavItem = document.getElementById('admin-nav-item');
        if (adminNavItem) {
            const ADMIN_ID = '845829137251567';
            if (String(u.id) === ADMIN_ID || u.role === 'admin' || u.role === 'owner') {
                adminNavItem.classList.remove('hidden');
            }
        }
    };

    updateUI(user);

    // Logout handling
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('current_user');
            GitHubAPI.hidePauseModal();
            window.location.href = '../../index.html';
        });
    }

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

    // Load all settings
    const loadAllSettings = () => {
        const settings = JSON.parse(localStorage.getItem('user_settings')) || {
            showJoinDate: true,
            showContributions: true,
            compactSidebar: false,
            animations: true
        };

        document.getElementById('setting-show-join-date').checked = settings.showJoinDate;
        document.getElementById('setting-show-contributions').checked = settings.showContributions;
        document.getElementById('setting-compact-sidebar').checked = settings.compactSidebar;
        document.getElementById('setting-animations').checked = settings.animations;

        applyInterfaceSettings(settings);
    };

    const applyInterfaceSettings = (settings) => {
        // Apply animations
        if (settings.animations) {
            document.body.classList.remove('no-animations');
        } else {
            document.body.classList.add('no-animations');
        }

        // Update profile preview based on visibility settings
        const joinDateEl = document.getElementById('settings-join-date');
        if (joinDateEl) {
            joinDateEl.style.display = settings.showJoinDate ? 'block' : 'none';
        }
    };

    // Save settings
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const settings = {
                showJoinDate: document.getElementById('setting-show-join-date').checked,
                showContributions: document.getElementById('setting-show-contributions').checked,
                compactSidebar: document.getElementById('setting-compact-sidebar').checked,
                animations: document.getElementById('setting-animations').checked
            };

            localStorage.setItem('user_settings', JSON.stringify(settings));
            applyInterfaceSettings(settings);

            // Show success feedback
            const originalText = btnSaveSettings.innerHTML;
            btnSaveSettings.innerHTML = '<i class="fas fa-check"></i> Settings Saved!';
            btnSaveSettings.style.background = '#3ba55c';
            
            setTimeout(() => {
                btnSaveSettings.innerHTML = originalText;
                btnSaveSettings.style.background = '';
            }, 2000);
        });
    }

    // Reset settings
    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) {
        btnResetSettings.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all settings to default?')) {
                const defaults = {
                    showJoinDate: true,
                    showContributions: true,
                    compactSidebar: false,
                    animations: true
                };
                
                localStorage.setItem('user_settings', JSON.stringify(defaults));
                loadAllSettings();
            }
        });
    }

    // Initial load
    loadSounds();
    loadAllSettings();
});
