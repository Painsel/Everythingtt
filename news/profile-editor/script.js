document.addEventListener('DOMContentLoaded', async () => {
    console.log('Profile Editor loaded');
    const rawUser = localStorage.getItem('current_user');
    console.log('Raw current_user from localStorage:', rawUser);
    
    let currentUser = JSON.parse(rawUser);
    if (!currentUser || currentUser.isGuest) {
        console.warn('No valid user session found, redirecting to homepage...');
        window.location.href = '../homepage/';
        return;
    }

    let userSha = null;

    // Security check: IP Address restriction
    async function checkIP() {
        if (!currentUser || currentUser.isGuest) return;
        try {
            const currentIp = await GitHubAPI.getClientIP();
            if (currentIp && currentUser.allowedIp && !GitHubAPI.compareIPs(currentUser.allowedIp, currentIp)) {
                console.error('IP Mismatch detected. Logging out.');
                localStorage.removeItem('current_user');
                window.location.href = '../index.html?error=ip_mismatch';
            } else if (currentIp && currentUser.allowedIp && currentUser.allowedIp !== currentIp && GitHubAPI.compareIPs(currentUser.allowedIp, currentIp)) {
                // Dynamic IP update during session
                console.log(`[Security] Dynamic IP shift detected: ${currentUser.allowedIp} -> ${currentIp}`);
                currentUser.allowedIp = currentIp;
                localStorage.setItem('current_user', JSON.stringify(currentUser));
                
                // Update on server
                const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${currentUser.id}.json`);
                if (data) {
                    const serverUser = JSON.parse(atob(data.content));
                    serverUser.allowedIp = currentIp;
                    await GitHubAPI.updateFile(
                        `news/created-news-accounts-storage/${currentUser.id}.json`,
                        JSON.stringify(serverUser),
                        `Security: Session-based dynamic IP update for ${currentUser.username}`,
                        data.sha
                    );
                }
            }
        } catch (e) {
            console.error('Failed to verify IP during session:', e);
        }
    }

    // Initialize sidebar and fields
    function updateUI(user) {
        const statusIconName = (user.statusType === 'dnd') ? 'DoNotDisturb.png' : (user.status === 'idle' ? 'Idle.png' : (user.status === 'online' ? 'Online.png' : 'Offline.png'));
        const iconPath = GitHubAPI.getStatusIconPath(statusIconName);

        document.getElementById('side-pfp').src = user.pfp;
        document.getElementById('side-username').innerText = user.username;
        
        // Add badges to sidebar
        const sideUsername = document.getElementById('side-username');
        let sideBadgeContainer = sideUsername.nextElementSibling;
        if (!sideBadgeContainer || !sideBadgeContainer.classList.contains('badge-container')) {
            sideBadgeContainer = document.createElement('div');
            sideBadgeContainer.className = 'badge-container';
            sideBadgeContainer.style.display = 'inline-flex';
            sideBadgeContainer.style.marginLeft = '4px';
            sideBadgeContainer.style.verticalAlign = 'middle';
            sideUsername.parentNode.insertBefore(sideBadgeContainer, sideUsername.nextSibling);
        }
        sideBadgeContainer.innerHTML = `
            ${GitHubAPI.renderRoleBadge(user.role)}
            ${GitHubAPI.renderNewUserBadge(user.joinDate, 'user-badge side-badge')}
            ${GitHubAPI.renderThemeBadge('user-badge side-badge')}
        `;

        document.getElementById('side-status-icon').style.backgroundImage = `url('${iconPath}')`;

        // Preview
        document.getElementById('profile-pfp').src = user.pfp;
        document.getElementById('profile-banner').style.background = user.banner.startsWith('#') ? user.banner : `url(${user.banner})`;
        document.getElementById('profile-banner').style.backgroundSize = 'cover';
        document.getElementById('profile-username-display').innerText = user.username;
        document.getElementById('profile-id-display').innerText = `ID: ${user.id}`;
        document.getElementById('profile-bio-display').innerText = user.bio;

        // Status Preview
        updateStatusPreview(user);

        // Badges
        const badgeContainer = document.getElementById('badge-container');
        if (badgeContainer) {
            badgeContainer.innerHTML = `
                ${GitHubAPI.renderRoleBadge(user.role)}
                ${GitHubAPI.renderNewUserBadge(user.joinDate)}
                ${GitHubAPI.renderThemeBadge()}
            `;
        }

        // Form
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-bio').value = user.bio;
        document.getElementById('edit-status-msg').value = user.statusMsg || '';
        document.getElementById('edit-status-type').value = user.statusType || 'auto';
    }

    // Initial UI render from localStorage
    updateUI(currentUser);

    function updateStatusPreview(userOverride = null) {
        const msg = document.getElementById('edit-status-msg').value;
        const type = document.getElementById('edit-status-type').value;
        const bubble = document.getElementById('status-bubble');
        const icon = document.getElementById('status-icon');

        if (msg) {
            bubble.innerText = msg;
            bubble.style.display = 'block';
        } else {
            bubble.style.display = 'none';
        }

        // Use the manual type if set, otherwise fallback to current user status or Online
        let iconName = 'Online.png';
        if (type === 'dnd') {
            iconName = 'DoNotDisturb.png';
        } else {
            const currentStatus = userOverride ? userOverride.status : (currentUser ? currentUser.status : 'online');
            iconName = currentStatus === 'idle' ? 'Idle.png' : (currentStatus === 'online' ? 'Online.png' : 'Offline.png');
        }
        
        const iconUrl = GitHubAPI.getStatusIconPath(iconName);
        icon.style.backgroundImage = `url('${iconUrl}')`;
    }

    // Initial check and background sync
    checkIP(); 
    setInterval(checkIP, 60000); // Check IP every 60s

    // Background profile sync
    async function pollUserProfile() {
        // Skip polling if page is hidden or user is typing/editing
        if (document.hidden || (currentUser && currentUser.isGuest)) return;
        
        const activeElement = document.activeElement;
        const isEditing = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
        if (isEditing) return;

        const updated = await GitHubAPI.syncUserProfile((newUser) => {
            currentUser = newUser;
            updateUI(newUser);
        });
        if (updated) {
            currentUser = updated;
        }
    }
    
    // Initial sync
    pollUserProfile();
    // Poll every 30s
    setInterval(pollUserProfile, 30000);

    let pendingPfpBase64 = null;
    let pendingBannerBase64 = null;
    let cropper = null;
    let currentCroppingType = null; // 'pfp' or 'banner'

    const modal = document.getElementById('cropper-modal');
    const cropperImage = document.getElementById('cropper-image');
    const btnApplyCrop = document.getElementById('btn-apply-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const closeModal = document.querySelector('.close-modal');
    const uploadPfp = document.getElementById('upload-pfp');
    const uploadBanner = document.getElementById('upload-banner');
    const btnSave = document.getElementById('btn-save-profile');
    const btnLogout = document.getElementById('btn-logout');

    function openCropper(file, type) {
        const reader = new FileReader();
        reader.onload = (e) => {
            cropperImage.src = e.target.result;
            modal.classList.add('active');
            currentCroppingType = type;

            if (type === 'pfp') {
                modal.classList.add('is-pfp-crop');
            } else {
                modal.classList.remove('is-pfp-crop');
            }

            if (cropper) cropper.destroy();
            
            const aspectRatio = type === 'pfp' ? 1 : 3; // 1:1 for PFP, 3:1 for Banner
            cropper = new Cropper(cropperImage, {
                aspectRatio: aspectRatio,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
    }

    function closeCropperModal() {
        modal.classList.remove('active');
        modal.classList.remove('is-pfp-crop');
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        currentCroppingType = null;
        
        // Reset file inputs so change event triggers again if same file selected
        uploadPfp.value = '';
        uploadBanner.value = '';
    }

    btnApplyCrop.addEventListener('click', () => {
        if (!cropper) return;

        const canvasOptions = currentCroppingType === 'pfp' 
            ? { width: 256, height: 256 } 
            : { width: 1200, height: 400 };

        const croppedCanvas = cropper.getCroppedCanvas(canvasOptions);
        const quality = currentCroppingType === 'pfp' ? 0.7 : 0.6;
        const base64 = croppedCanvas.toDataURL('image/jpeg', quality);

        if (currentCroppingType === 'pfp') {
            pendingPfpBase64 = base64;
            document.getElementById('profile-pfp').src = base64;
        } else {
            pendingBannerBase64 = base64;
            document.getElementById('profile-banner').style.background = `url(${base64})`;
            document.getElementById('profile-banner').style.backgroundSize = 'cover';
        }

        closeCropperModal();
    });

    [btnCancelCrop, closeModal].forEach(btn => {
        if (btn) btn.addEventListener('click', closeCropperModal);
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeCropperModal();
    });

    async function optimizeImage(file, maxWidth, maxHeight, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Export as JPEG with variable quality
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('current_user');
        window.location.href = '../index.html';
    });

    btnSave.addEventListener('click', async () => {
        const username = document.getElementById('edit-username').value;
        const bio = document.getElementById('edit-bio').value;
        const statusMsg = document.getElementById('edit-status-msg').value;
        const statusType = document.getElementById('edit-status-type').value;

        if (!username) return alert('Username is required');
        if (username.length > 100) return alert('Display Name cannot be longer than 100 characters');
        if (bio.length > 300) return alert('Bio cannot be longer than 300 characters');
        if (statusMsg.length > 30) return alert('Status Message cannot be longer than 30 characters');

        // Check for rule violations
        const contentToCheck = `${username} ${bio} ${statusMsg}`;
        const ruleCheck = await GitHubAPI.checkContentForRules(contentToCheck);
        
        if (!ruleCheck.isClean) {
            GitHubAPI.showRulesWarningModal(ruleCheck.violatedWords, '../');
            return;
        }

        try {
            btnSave.disabled = true;
            btnSave.innerText = 'Processing...';

            // Start with current values, then apply any pending updates (cropped or optimized)
            let pfp = pendingPfpBase64 || currentUser.pfp;
            let banner = pendingBannerBase64 || currentUser.banner;

            // Handle file uploads as fallback (though they should already be in pendingBase64)
            const pfpFile = uploadPfp.files[0];
            const bannerFile = uploadBanner.files[0];

            if (pfpFile && !pendingPfpBase64) {
                pfp = await optimizeImage(pfpFile, 256, 256, 0.7);
            }

            if (bannerFile && !pendingBannerBase64) {
                banner = await optimizeImage(bannerFile, 1200, 400, 0.6);
            }

            btnSave.innerText = 'Saving...';

            const updatedUser = {
                ...currentUser,
                username,
                pfp,
                banner,
                bio,
                statusMsg,
                statusType
            };

            const res = await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentUser.id}.json`,
                updatedUser,
                `Update profile: ${username}`
            );

            userSha = res.content.sha;
            currentUser = updatedUser;
            currentUser.sha = userSha; 
            localStorage.setItem('current_user', JSON.stringify(currentUser));
            updateUI(currentUser);
            
            // Clear file inputs
            uploadPfp.value = '';
            uploadBanner.value = '';
            pendingPfpBase64 = null;
            pendingBannerBase64 = null;
            
            alert('Profile updated successfully!');
        } catch (e) {
            console.error('Save failed:', e);
            alert('Failed to save profile: ' + e.message);
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = 'Save Changes';
        }
    });

    // Real-time preview listeners for files
    uploadPfp.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const MAX_SIZE = 2 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                alert('Profile Picture is too large (max 2MB)');
                uploadPfp.value = '';
                return;
            }
            if (file.type === 'image/gif') {
                alert('GIFs are not allowed');
                uploadPfp.value = '';
                return;
            }

            // BETA Feature: Cropping Tool
            if (GitHubAPI.isBetaTester(currentUser)) {
                openCropper(file, 'pfp');
            } else {
                try {
                    pendingPfpBase64 = await optimizeImage(file, 256, 256, 0.7);
                    document.getElementById('profile-pfp').src = pendingPfpBase64;
                } catch (err) {
                    console.error('PFP preview failed:', err);
                }
            }
        }
    });

    uploadBanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const MAX_SIZE = 2 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                alert('Profile Banner is too large (max 2MB)');
                uploadBanner.value = '';
                return;
            }
            if (file.type === 'image/gif') {
                alert('GIFs are not allowed');
                uploadBanner.value = '';
                return;
            }

            // BETA Feature: Cropping Tool
            if (GitHubAPI.isBetaTester(currentUser)) {
                openCropper(file, 'banner');
            } else {
                try {
                    pendingBannerBase64 = await optimizeImage(file, 1200, 400, 0.6);
                    document.getElementById('profile-banner').style.background = `url(${pendingBannerBase64})`;
                    document.getElementById('profile-banner').style.backgroundSize = 'cover';
                } catch (err) {
                    console.error('Banner preview failed:', err);
                }
            }
        }
    });

    // Real-time preview listeners
    ['edit-username', 'edit-bio', 'edit-status-msg', 'edit-status-type'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const val = document.getElementById(id).value;
            if (id === 'edit-username') document.getElementById('profile-username-display').innerText = val;
            if (id === 'edit-bio') document.getElementById('profile-bio-display').innerText = val;
            if (id.startsWith('edit-status')) updateStatusPreview();
        });
    });
    
    // Also handle 'change' for the select
    document.getElementById('edit-status-type').addEventListener('change', updateStatusPreview);
});
