document.addEventListener('DOMContentLoaded', async () => {
    console.log('Profile Editor loaded');
    const rawUser = localStorage.getItem('current_user');
    console.log('Raw current_user from localStorage:', rawUser);
    
    let currentUser = JSON.parse(rawUser);
    if (!currentUser) {
        console.warn('No user found in localStorage, redirecting to login in 2 seconds...');
        // Show an error on screen instead of just redirecting
        document.body.innerHTML = `
            <div style="background: #36393f; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;">
                <h2>Session Expired</h2>
                <p>We couldn't find your login session. Redirecting to login...</p>
                <button onclick="window.location.href='../index.html'" style="background: #5865f2; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Go to Login</button>
            </div>
        `;
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        return;
    }

    let userSha = null;

    // Initialize sidebar and fields
    function updateUI(user) {
        document.getElementById('side-pfp').src = user.pfp;
        document.getElementById('side-username').innerText = user.username;
        
        // Preview
        document.getElementById('profile-pfp').src = user.pfp;
        document.getElementById('profile-banner').style.background = user.banner.startsWith('#') ? user.banner : `url(${user.banner})`;
        document.getElementById('profile-banner').style.backgroundSize = 'cover';
        document.getElementById('profile-username-display').innerText = user.username;
        document.getElementById('profile-id-display').innerText = `ID: ${user.id}`;
        document.getElementById('profile-bio-display').innerText = user.bio;

        // Form
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-bio').value = user.bio;
        document.getElementById('edit-status-msg').value = user.statusMsg || '';
        document.getElementById('edit-status-type').value = user.statusType || 'auto';

        updateStatusPreview();
    }

    function updateStatusPreview() {
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

        // For preview, we show the manual status or Online if auto
        let iconUrl = '../../User Status Icons/Online.png';
            if (type === 'dnd') iconUrl = '../../User Status Icons/DoNotDisturb.png';
        
        icon.style.backgroundImage = `url('${iconUrl}')`;
    }

    updateUI(currentUser);

    // Fetch latest SHA for updates
    try {
        const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${currentUser.id}.json`);
        if (data) {
            userSha = data.sha;
            // Optionally update local user if remote changed
            const remoteUser = JSON.parse(data.content);
            if (JSON.stringify(remoteUser) !== JSON.stringify(currentUser)) {
                currentUser = remoteUser;
                localStorage.setItem('current_user', JSON.stringify(currentUser));
                updateUI(currentUser);
            }
        }
    } catch (e) {
        console.warn('Could not fetch remote profile SHA:', e);
    }

    const btnSave = document.getElementById('btn-save-profile');
    const btnLogout = document.getElementById('btn-logout');
    const uploadPfp = document.getElementById('upload-pfp');
    const uploadBanner = document.getElementById('upload-banner');

    async function optimizeImage(file, maxWidth, maxHeight) {
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

                    // Export as JPEG with 80% quality
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
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

        try {
            btnSave.disabled = true;
            btnSave.innerText = 'Processing Images...';

            let pfp = currentUser.pfp;
            let banner = currentUser.banner;

            // Handle file uploads by converting to Base64
            const pfpFile = uploadPfp.files[0];
            const bannerFile = uploadBanner.files[0];

            if (pfpFile) {
                pfp = await optimizeImage(pfpFile, 256, 256);
            }

            if (bannerFile) {
                banner = await optimizeImage(bannerFile, 1200, 400);
            }

            btnSave.innerText = 'Saving Profile...';

            const updatedUser = {
                ...currentUser,
                username,
                pfp,
                banner,
                bio,
                statusMsg,
                statusType
            };

            const res = await GitHubAPI.updateFile(
                `news/created-news-accounts-storage/${currentUser.id}.json`,
                JSON.stringify(updatedUser),
                `Update profile: ${username}`,
                userSha
            );

            userSha = res.content.sha;
            currentUser = updatedUser;
            currentUser.sha = userSha; // Preserve SHA for status tracking
            localStorage.setItem('current_user', JSON.stringify(currentUser));
            updateUI(currentUser);
            
            // Clear file inputs
            uploadPfp.value = '';
            uploadBanner.value = '';
            
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
            try {
                const optimized = await optimizeImage(file, 256, 256);
                document.getElementById('profile-pfp').src = optimized;
            } catch (err) {
                console.error('PFP preview failed:', err);
            }
        }
    });

    uploadBanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const optimized = await optimizeImage(file, 1200, 400);
                document.getElementById('profile-banner').style.background = `url(${optimized})`;
                document.getElementById('profile-banner').style.backgroundSize = 'cover';
            } catch (err) {
                console.error('Banner preview failed:', err);
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
