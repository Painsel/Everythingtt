document.addEventListener('DOMContentLoaded', async () => {
    const authContainer = document.getElementById('auth-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnSaveProfile = document.getElementById('btn-save-profile');

    let currentUser = null;
    let userSha = null;

    // Load session if exists
    const savedUser = localStorage.getItem('current_user');
     if (savedUser) {
         const user = GitHubAPI.safeParse(savedUser);
         if (user) {
             if (user.isGuest) {
            console.log('Guest session detected, redirecting...');
            window.location.href = 'homepage/';
            return;
        }

        console.log('Auto-login detected, verifying account integrity...');
        
        // Server-side check: Verify user still exists in storage
        try {
            GitHubAPI.showPauseModal('Authenticating your session...');
            const verifiedUser = await GitHubAPI.syncUserProfile();
            if (verifiedUser) {
                console.log('Account verified, redirecting to dashboard...');
                localStorage.setItem('show_welcome_toast', 'true');
                window.location.href = 'homepage/';
                return;
            } else {
                console.warn('Account no longer exists or was deleted. Session cleared.');
                localStorage.removeItem('current_user');
            }
        } catch (e) {
            console.error('Account verification failed:', e);
            // Fallback: stay on login page if verification fails critically
        } finally {
            GitHubAPI.hidePauseModal();
        }
    }

    const loginForm = document.getElementById('login-form');
    const btnGuest = document.getElementById('btn-guest');
    const togglePassword = document.getElementById('toggle-password');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');

    // Password Visibility Toggle
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const isPassword = loginPassword.getAttribute('type') === 'password';
            const type = isPassword ? 'text' : 'password';
            loginPassword.setAttribute('type', type);
            
            // Update eye icon and aria-label for accessibility
            const eyeIcon = togglePassword.querySelector('.eye-icon');
            if (eyeIcon) {
                eyeIcon.innerText = isPassword ? '👁️‍🗨️' : '👁️';
            }
            togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    }

    // Real-time Validation
    const validateInput = (input, feedback, minLength, message) => {
        const group = input.closest('.input-group');
        if (input.value.length === 0) {
            group.classList.remove('error', 'success');
            feedback.classList.remove('visible');
            return false;
        }
        if (input.value.length < minLength) {
            group.classList.add('error');
            group.classList.remove('success');
            feedback.innerText = message;
            feedback.classList.add('visible', 'error');
            feedback.classList.remove('success');
            return false;
        } else {
            group.classList.add('success');
            group.classList.remove('error');
            feedback.innerText = 'Looks good!';
            feedback.classList.add('visible', 'success');
            feedback.classList.remove('error');
            return true;
        }
    };

    if (loginUsername && loginPassword) {
        const userFeedback = loginUsername.nextElementSibling;
        const passFeedback = loginPassword.nextElementSibling.nextElementSibling; // After toggle button

        loginUsername.addEventListener('input', () => {
            validateInput(loginUsername, userFeedback, 3, 'Username must be at least 3 characters.');
        });

        loginPassword.addEventListener('input', () => {
            validateInput(loginPassword, passFeedback, 6, 'Password must be at least 6 characters.');
        });
    }

    btnGuest.addEventListener('click', () => {
        const guestUser = {
            username: 'Guest',
            id: 'guest_' + Math.random().toString(36).substr(2, 9),
            isGuest: true,
            pfp: 'https://painsel.github.io/Everythingtt/news/default-pfp.png', // Assuming there's a default PFP
            status: 'Browsing as Guest',
            bio: 'Guests have read-only access to the platform.'
        };
        localStorage.setItem('current_user', JSON.stringify(guestUser));
        window.location.href = 'homepage/';
    });

    // Handle security errors from redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'ip_mismatch') {
        showNotification('Security Alert', 'You have been logged out because your IP address changed. This account is restricted to its original IP for security.', 'error');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginUsername.value.trim();
        const password = loginPassword.value;

        // Final validation check
        const userFeedback = loginUsername.nextElementSibling;
        const passFeedback = loginPassword.nextElementSibling.nextElementSibling;

        const isUserValid = validateInput(loginUsername, userFeedback, 3, 'Username must be at least 3 characters.');
        const isPassValid = validateInput(loginPassword, passFeedback, 6, 'Password must be at least 6 characters.');

        if (!isUserValid || !isPassValid) {
            return showNotification('Invalid Input', 'Please correct the errors in the form before submitting.', 'warning');
        }
        
        if (username.length > 100 || password.length > 100) {
            return showNotification('Limit Exceeded', 'Credentials are too long.', 'warning');
        }

        // Check for privacy consent
        const consent = localStorage.getItem('privacy_consent');
        if (consent === null) {
            const modal = document.getElementById('privacy-modal');
            modal.classList.remove('hidden');

            return new Promise((resolve) => {
                document.getElementById('btn-accept-privacy').onclick = () => {
                    localStorage.setItem('privacy_consent', 'true');
                    modal.classList.add('hidden');
                    // Continue login flow
                    handleLoginFlow(username, password);
                };
                document.getElementById('btn-decline-privacy').onclick = () => {
                    localStorage.setItem('privacy_consent', 'false');
                    modal.classList.add('hidden');
                    // Continue login flow (faking refusal)
                    handleLoginFlow(username, password);
                };
            });
        }

        handleLoginFlow(username, password);
    });

    async function handleLoginFlow(username, password) {
        const consent = localStorage.getItem('privacy_consent') !== 'false';
        const btnText = btnLogin.querySelector('.btn-text');
        const btnLoader = btnLogin.querySelector('.btn-loader');

        GitHubAPI.showPauseModal('Signing you in...');
        try {
            btnLogin.disabled = true;
            if (btnText) btnText.innerText = 'Connecting...';
            if (btnLoader) btnLoader.classList.remove('hidden');

            // Get client IP for security
            if (consent) {
                if (btnText) btnText.innerText = 'Verifying IP...';
            } else {
                if (btnText) btnText.innerText = 'Securing Session...'; 
            }
            const currentIp = await GitHubAPI.getClientIP();
            if (!currentIp) {
                throw new Error('Could not verify your IP address. Please check your connection or disable ad-blockers.');
            }

            // Check if IP is banned
            const banListData = await GitHubAPI.getFile('banned-ips.json');
            if (banListData) {
                const bannedIps = GitHubAPI.safeParse(banListData.content) || [];
                const banRecord = bannedIps.find(b => (typeof b === 'string' ? b === currentIp : b.ip === currentIp));
                
                if (banRecord) {
                    // Check if the user trying to log in is the admin/developer
                    // Since we haven't searched for the user yet, we need to find them first 
                    // or allow the check to proceed to user search.
                    // However, the ban check happens BEFORE user search.
                    // Let's modify the flow to allow the admin to bypass even if their IP is banned.
                    
                    // We'll search for the user FIRST if an IP ban is hit, to see if it's the admin.
                    console.warn(`[Security] Banned IP detected (${currentIp}), checking if user is admin...`);
                }
            }

            // Check if user exists
            const files = await GitHubAPI.listFiles('created-news-accounts-storage');
            let foundUser = null;

            if (files.length > 0) {
                btnLogin.innerText = consent ? 'Searching...' : 'Checking...';
                for (const file of files) {
                    if (file.type !== 'file' || !file.name.endsWith('.json')) continue;
                    
                    // Use getFileRaw for high-speed searching
                    const content = await GitHubAPI.getFileRaw(file.path);
                    if (!content) continue;
                    
                    let user;
                    try {
                        // Use GitHubAPI.safeParse to handle potential v2 encryption consistently
                        user = GitHubAPI.safeParse(content);
                    } catch (e) {
                        console.warn(`[Auth] Failed to parse user data for ${file.path}:`, e);
                        continue;
                    }

                    if (user.username === username) {
                        if (user.password === password) {
                            // Security check: IP Address restriction
                            const ADMIN_ID = '845829137251567';
                            const isAdminOverride = String(user.id) === ADMIN_ID;

                            // If we hit an IP ban earlier, and this is NOT the admin, block them now
                            const banListData = await GitHubAPI.getFile('banned-ips.json');
                            if (banListData && !isAdminOverride) {
                                const bannedIps = GitHubAPI.safeParse(banListData.content) || [];
                                const banRecord = bannedIps.find(b => (typeof b === 'string' ? b === currentIp : b.ip === currentIp));
                                if (banRecord) {
                                    btnLogin.disabled = false;
                                    btnLogin.innerText = 'Login / Sign Up';
                                    if (typeof banRecord === 'object') {
                                        const reason = banRecord.reason || 'No reason provided';
                                        const admin = banRecord.bannedBy || 'System';
                                        return showNotification('Access Denied', `Your IP address has been banned.\n\nReason: ${reason}\nBanned by: ${admin}`, 'error');
                                    } else {
                                        return showNotification('Security Error', 'Your IP address has been banned from this service.', 'error');
                                    }
                                }
                            }
                            
                            if (user.allowedIp && !GitHubAPI.compareIPs(user.allowedIp, currentIp)) {
                                if (isAdminOverride) {
                                    console.log('[Security] Admin IP override triggered - allowing login from new IP');
                                    // Update allowedIp for the admin so they don't get locked out during session
                                    user.allowedIp = currentIp;
                                } else {
                                    btnLogin.disabled = false;
                                    btnLogin.innerText = 'Login / Sign Up';
                                    return showNotification('Security Error', 'This account is restricted to a different network. If you recently moved or changed ISPs, please contact the admin to reset your IP lock.', 'error');
                                }
                            }
                            
                            // If subnet matches but IP is slightly different, update it to follow the dynamic IP
                            let ipUpdated = false;
                            if (user.allowedIp && user.allowedIp !== currentIp && GitHubAPI.compareIPs(user.allowedIp, currentIp)) {
                                console.log(`[Security] Updating dynamic IP for ${user.username}: ${user.allowedIp} -> ${currentIp}`);
                                user.allowedIp = currentIp;
                                ipUpdated = true;
                            }

                            // Migration: If account has no allowedIp (very old accounts), set it now
                            if (!user.allowedIp) {
                                user.allowedIp = currentIp;
                                ipUpdated = true;
                            }

                            // For Admin, always ensure the remote record is updated with the new IP if it changed
                            if (isAdminOverride && user.allowedIp === currentIp) {
                                ipUpdated = true;
                            }

                            // Reset forceLogout if it was set or if IP was updated
                            if (user.forceLogout || ipUpdated) {
                                user.forceLogout = false;
                                // We need the SHA to update
                                const data = await GitHubAPI.getFile(file.path);
                                await GitHubAPI.updateFile(
                                    file.path,
                                    JSON.stringify(user),
                                    ipUpdated ? `Security: Updated dynamic IP for ${user.username}` : `User login: Reseting forceLogout for ${user.username}`,
                                    data.sha
                                );
                            }

                            foundUser = user;
                            // We still need the SHA for the actual login sync later, so fetch it now
                            const data = await GitHubAPI.getFile(file.path);
                            userSha = data.sha;
                            break;
                        } else {
                            btnLogin.disabled = false;
                            btnLogin.innerText = 'Login / Sign Up';
                            return showNotification('Authentication Failed', 'The password you entered is incorrect. Please try again.', 'error');
                        }
                    }
                }
            }

            if (!foundUser) {
                btnLogin.innerText = consent ? 'Creating Account...' : 'Signing You Up...';
                // Create new user
                const newUser = {
                    id: GitHubAPI.generateID().toString(),
                    username,
                    password,
                    pfp: 'https://placehold.co/150',
                    banner: '#7289da',
                    bio: 'Welcome to my profile!',
                    joinDate: new Date().toISOString(),
                    contributions: 0,
                    ettCoins: 0,
                    allowedIp: currentIp, // Lock account to this IP
                    privacyConsent: consent // Store their choice
                };
                const res = await GitHubAPI.updateFile(`created-news-accounts-storage/${newUser.id}.json`, JSON.stringify(newUser), `Create user ${username}`);
                userSha = res.content.sha; // Capture SHA for future updates
                foundUser = newUser;
            } else {
                // For existing users, update joinDate and contributions if needed
                btnLogin.innerText = consent ? 'Syncing Profile...' : 'Finishing...';
                let needsUpdate = false;
                
                // Migration: Set allowedIp if not present
                if (!foundUser.allowedIp) {
                    foundUser.allowedIp = currentIp;
                    needsUpdate = true;
                }

                // Store privacy consent if not present or changed
                if (foundUser.privacyConsent !== consent) {
                    foundUser.privacyConsent = consent;
                    needsUpdate = true;
                }

                // Ensure contributions is a number
                if (foundUser.contributions === undefined) {
                    foundUser.contributions = 0;
                    needsUpdate = true;
                }

                // Migration: Initialize ETT Coins
                if (foundUser.ettCoins === undefined) {
                    foundUser.ettCoins = 0;
                    needsUpdate = true;
                }

                // Recalculate contributions
                const articles = await GitHubAPI.listFiles('created-articles-storage');
                let count = 0;
                for (const file of articles) {
                    if (file.name.endsWith('.json')) {
                        // Use getFileRaw for speed
                        const content = await GitHubAPI.getFileRaw(file.path);
                        if (content) {
                            try {
                                // Articles might be encrypted too
                                const article = GitHubAPI.safeParse(content);
                                if (article && article.authorId === foundUser.id) {
                                    count++;
                                }
                            } catch(e) {}
                        }
                    }
                }
                
                if (foundUser.contributions !== count) {
                    foundUser.contributions = count;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    const res = await GitHubAPI.safeUpdateFile(
                        `created-news-accounts-storage/${foundUser.id}.json`,
                        JSON.stringify(foundUser),
                        `Update account metadata for ${foundUser.username}`
                    );
                    userSha = res.content.sha;
                }
            }

            showDashboard(foundUser);
            window.location.href = 'homepage/';
        } catch (e) {
            console.error('Auth Error:', e);
            showNotification('Authentication Error', e.message || 'An unexpected error occurred during login.', 'error');
        } finally {
            GitHubAPI.hidePauseModal();
            btnLogin.disabled = false;
            btnLogin.innerText = 'Login / Sign Up';
        }
    }

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('current_user');
        localStorage.removeItem('gh_pat');
        location.reload();
    });

    btnSaveProfile.addEventListener('click', async () => {
        const pfp = document.getElementById('edit-pfp').value;
        const banner = document.getElementById('edit-banner').value;
        const username = document.getElementById('edit-username').value;
        const bio = document.getElementById('edit-bio').value;

        if (!username) return showNotification('Required Field', 'Username is required.', 'warning');
        if (username.length > 100) return showNotification('Limit Exceeded', 'Username cannot be longer than 100 characters.', 'warning');
        if (bio.length > 300) return showNotification('Limit Exceeded', 'Bio cannot be longer than 300 characters.', 'warning');

        currentUser.pfp = pfp;
        currentUser.banner = banner;
        currentUser.username = username;
        currentUser.bio = bio;

        try {
            const res = await GitHubAPI.safeUpdateFile(`created-news-accounts-storage/${currentUser.id}.json`, JSON.stringify(currentUser), `Update profile ${currentUser.username}`);
            userSha = res.content.sha;
            showDashboard(currentUser);
            showNotification('Profile Saved', 'Your profile changes have been applied successfully.', 'success');
        } catch (e) {
            showNotification('Update Failed', 'Error saving profile: ' + e.message, 'error');
        }
    });

    function showDashboard(user) {
        currentUser = user;
        user.sha = userSha; // Ensure SHA is stored for status exit tracking
        localStorage.setItem('current_user', JSON.stringify(user));
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        document.body.classList.add('sidebar-layout');

        document.getElementById('welcome-msg').innerText = `Hello ${user.username}, welcome to EverythingTT's News Dashboard. Please read our guidelines before you can publish your news.`;
        document.getElementById('side-username').innerText = user.username;
        document.getElementById('side-pfp').src = user.pfp;

        // ETT Coins display
        const ettCoinsCount = document.getElementById('ett-coins-count');
        if (ettCoinsCount) {
            ettCoinsCount.innerText = (user.ettCoins || 0).toLocaleString();
        }

        // Profile Display
        document.getElementById('profile-pfp').src = user.pfp;
        document.getElementById('profile-banner').style.background = user.banner.startsWith('#') ? user.banner : `url(${user.banner})`;
        document.getElementById('profile-username-display').innerText = user.username;
        document.getElementById('profile-id-display').innerText = `ID: ${user.id}`;
        document.getElementById('profile-bio-display').innerText = user.bio;
        
        // Badges
        const badgeContainerId = 'dashboard-badge-container';
        let badgeContainer = document.getElementById(badgeContainerId);
        if (!badgeContainer) {
            badgeContainer = document.createElement('div');
            badgeContainer.id = badgeContainerId;
            badgeContainer.style.display = 'inline-flex';
            badgeContainer.style.marginLeft = '8px';
            badgeContainer.style.verticalAlign = 'middle';
            document.getElementById('profile-username-display').appendChild(badgeContainer);
        }
        badgeContainer.innerHTML = `
            ${GitHubAPI.renderRoleBadge(user.role)}
            ${GitHubAPI.renderNewUserBadge(user.joinDate)}
            ${GitHubAPI.renderThemeBadge()}
        `;

        // Stats
        const joinDate = user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Early Member';
        document.getElementById('profile-contributions-display').innerText = `📚 ${user.contributions || 0} Articles`;
        document.getElementById('profile-join-display').innerText = `🗓️ Joined ${joinDate}`;

        // Editor Fields
        document.getElementById('edit-pfp').value = user.pfp;
        document.getElementById('edit-banner').value = user.banner;
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-bio').value = user.bio;
    }
});
