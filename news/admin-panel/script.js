const user = GitHubAPI.safeParse(localStorage.getItem('current_user'));
const DEVELOPER_ID = '845829137251567';

// Top-level Security Check (Backup to inline check)
if (!user || (user.role !== 'admin' && user.role !== 'owner' && user.id !== DEVELOPER_ID)) {
    window.location.replace('../homepage/');
}

document.addEventListener('DOMContentLoaded', async () => {
    // Server-side check: Verify user still exists and is still an admin
    try {
        GitHubAPI.showPauseModal('Verifying admin privileges...');
        const verifiedUser = await GitHubAPI.syncUserProfile();
        const DEVELOPER_ID = '845829137251567';
        if (!verifiedUser || (verifiedUser.role !== 'admin' && verifiedUser.role !== 'owner' && String(verifiedUser.id) !== DEVELOPER_ID)) {
            console.error('[Security] Admin verification failed server-side.');
            if (!verifiedUser) localStorage.removeItem('current_user');
            window.location.replace('../homepage/');
            return;
        }
    } catch (e) {
        console.warn('[Security] Could not verify admin status server-side.', e);
    } finally {
        GitHubAPI.hidePauseModal();
    }

    // UI Elements
    document.getElementById('side-pfp').src = user.pfp;
    document.getElementById('side-username').innerText = user.username;

    // Update ETT Coins display
    const ettCoinsCount = document.getElementById('ett-coins-count');
    if (ettCoinsCount) {
        ettCoinsCount.innerText = (user.ettCoins || 0).toLocaleString();
    }

    const accountsList = document.getElementById('accounts-list');
    const accountSearch = document.getElementById('account-search');
    
    // Modals
    const resetIpModal = document.getElementById('reset-ip-modal');
    const changePwModal = document.getElementById('change-pw-modal');
    const deleteAccountModal = document.getElementById('delete-account-modal');
    const banIpModal = document.getElementById('ban-ip-modal');
    const unbanIpModal = document.getElementById('unban-ip-modal');
    const accountInfoModal = document.getElementById('account-info-modal');
    const accountActionsModal = document.getElementById('account-actions-modal');
    const manageViolationsModal = document.getElementById('manage-violations-modal');
    const linkMailModal = document.getElementById('link-mail-modal');
    const closeModals = document.querySelectorAll('.close-modal');
    const modals = [resetIpModal, changePwModal, deleteAccountModal, banIpModal, unbanIpModal, accountInfoModal, accountActionsModal, manageViolationsModal, linkMailModal];
    
    // Define window-scoped functions first to avoid ReferenceErrors
    window.openResetIp = (userId, username) => {
        currentEditingUserId = userId;
        const targetEl = document.getElementById('ip-target-user');
        if (targetEl) targetEl.innerText = username;
        const acc = allAccounts.find(a => a.id === userId);
        const ipInput = document.getElementById('new-ip');
        if (ipInput) ipInput.value = (acc && acc.allowedIp) || '';
        if (resetIpModal) resetIpModal.classList.remove('hidden');
    };

    window.openChangePw = (userId, username) => {
        currentEditingUserId = userId;
        const targetEl = document.getElementById('pw-target-user');
        if (targetEl) targetEl.innerText = username;
        const hiddenUser = document.getElementById('pw-username-hidden');
        if (hiddenUser) hiddenUser.value = username;
        const newPwInput = document.getElementById('new-pw');
        if (newPwInput) newPwInput.value = '';
        if (changePwModal) changePwModal.classList.remove('hidden');
    };

    window.openDeleteAccount = (userId, username) => {
        currentEditingUserId = userId;
        const targetEl = document.getElementById('delete-target-user');
        if (targetEl) targetEl.innerText = username;
        if (deleteAccountModal) deleteAccountModal.classList.remove('hidden');
    };

    window.openBanIp = (userId, username, ip) => {
        currentEditingUserId = userId;
        const targetUserEl = document.getElementById('ban-target-user');
        if (targetUserEl) targetUserEl.innerText = username;
        const targetIpEl = document.getElementById('ban-target-ip');
        if (targetIpEl) targetIpEl.innerText = ip || 'Unknown';
        if (banIpModal) banIpModal.classList.remove('hidden');
    };

    window.openManageViolations = (userId, username) => {
        currentEditingUserId = userId;
        const targetEl = document.getElementById('violations-target-user');
        if (targetEl) targetEl.innerText = username;
        
        const acc = allAccounts.find(a => a.id === userId);
        tempViolationCount = (acc && acc.violations) || 0;
        
        updateViolationModalUI();
        if (manageViolationsModal) manageViolationsModal.classList.remove('hidden');
    };

    window.openAccountInfo = async (userId) => {
        const loading = document.getElementById('info-loading');
        const content = document.getElementById('info-content');
        
        if (loading) loading.classList.remove('hidden');
        if (content) content.classList.add('hidden');
        if (accountInfoModal) accountInfoModal.classList.remove('hidden');

        try {
            const acc = allAccounts.find(a => a.id === userId);
            if (!acc) throw new Error('Account not found');

            const setInfo = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            };

            setInfo('info-username', acc.username);
            setInfo('info-password', acc.password);
            setInfo('info-id', acc.id);
            setInfo('info-join-date', acc.joinDate ? new Date(acc.joinDate).toLocaleString() : 'N/A');
            setInfo('info-violations', acc.violations || 0);
            
            const consentSpan = document.getElementById('info-privacy');
            if (consentSpan) {
                if (acc.privacyConsent === true) {
                    consentSpan.innerText = 'Accepted';
                    consentSpan.style.color = '#3ba55d';
                } else if (acc.privacyConsent === false) {
                    consentSpan.innerText = 'Declined';
                    consentSpan.style.color = '#ed4245';
                } else {
                    consentSpan.innerText = 'No Choice Made (Pre-Update)';
                    consentSpan.style.color = '#72767d';
                }
            }

            setInfo('info-ip', acc.allowedIp || 'None');

            if (acc.allowedIp && acc.allowedIp !== 'None') {
                try {
                    const ipRes = await fetch(`https://ipapi.co/${acc.allowedIp}/json/`);
                    const ipData = await ipRes.json();
                    
                    if (!ipData.error) {
                        setInfo('info-country', `${ipData.country_name} (${ipData.country_code})`);
                        setInfo('info-region', ipData.region);
                        setInfo('info-city', ipData.city);
                        setInfo('info-isp', ipData.org);
                        setInfo('info-org', ipData.org || 'N/A');
                        setInfo('info-timezone', ipData.timezone);
                    } else {
                        throw new Error(ipData.reason || 'IP lookup failed');
                    }
                } catch (e) {
                    console.warn('IP detail fetch failed:', e);
                    ['country', 'region', 'city', 'isp', 'org', 'timezone'].forEach(id => setInfo(`info-${id}`, 'Lookup Failed'));
                }
            } else {
                ['country', 'region', 'city', 'isp', 'org', 'timezone'].forEach(id => setInfo(`info-${id}`, 'N/A (No IP)'));
            }

            if (loading) loading.classList.add('hidden');
            if (content) content.classList.remove('hidden');
        } catch (e) {
            alert('Error fetching info: ' + e.message);
            if (accountInfoModal) accountInfoModal.classList.add('hidden');
        }
    };

    // Close modals when clicking outside
    window.onclick = (event) => {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    };

    // Close modals with X button
    closeModals.forEach(btn => {
        btn.onclick = () => {
            modals.forEach(m => m.classList.add('hidden'));
        };
    });

    let allAccounts = [];
    let currentEditingUserId = null;
    let currentEditingUsername = null;
    let currentEditingUserIp = null;

    // --- Violation Management logic ---
    let tempViolationCount = 0;
    const updateViolationModalUI = () => {
        const countEl = document.getElementById('current-violation-count');
        if (countEl) countEl.innerText = tempViolationCount;
        
        // Highlight active thresholds
        const thresholds = [3, 5, 10, 15, 20];
        thresholds.forEach(t => {
            const el = document.getElementById(`threshold-${t}`);
            if (el) {
                if (tempViolationCount >= t) {
                    el.style.color = '#ff4757';
                    el.style.fontWeight = 'bold';
                    el.style.opacity = '1';
                } else {
                    el.style.color = '#b9bbbe';
                    el.style.fontWeight = 'normal';
                    el.style.opacity = '0.6';
                }
            }
        });
    };

    const setTileClick = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
    };

    setTileClick('btn-inc-violations', () => {
        tempViolationCount++;
        updateViolationModalUI();
    });

    setTileClick('btn-dec-violations', () => {
        if (tempViolationCount > 0) tempViolationCount--;
        updateViolationModalUI();
    });

    setTileClick('btn-save-violations', async () => {
        if (!currentEditingUserId) return;
        const btn = document.getElementById('btn-save-violations');
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Syncing...';
            }

            await GitHubAPI.safeUpdateFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                { violations: tempViolationCount },
                `Admin: Updated violations to ${tempViolationCount} for user ${currentEditingUserId}`
            );

            alert('Violations updated successfully.');
            if (manageViolationsModal) manageViolationsModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to update violations: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Apply & Sync';
            }
        }
    });
    // --- End Violation Management logic ---

    // Fetch all accounts
    async function loadAccounts() {
        try {
            GitHubAPI.showPauseModal('Fetching all accounts from storage...');
            accountsList.innerHTML = '<p class="status-msg">Fetching all accounts from storage...</p>';
            const files = await GitHubAPI.listFiles('created-news-accounts-storage');
            
            const accountFiles = files.filter(f => f.name.endsWith('.json') && f.name !== '.gitkeep');
            
            allAccounts = await Promise.all(accountFiles.map(async (file) => {
                const data = await GitHubAPI.getFile(file.path);
                if (data) {
                    const account = GitHubAPI.safeParse(data.content);
                    if (account) {
                        account.sha = data.sha;
                        // Check if they broke rules
                        account.isRuleBreaker = await GitHubAPI.isRuleBreaker(account);
                        return account;
                    }
                    console.warn(`[AdminPanel] Failed to parse account data for ${file.path}`);
                }
                return null;
            }));

            allAccounts = allAccounts.filter(a => a !== null);
            renderAccounts(allAccounts);
        } catch (e) {
            console.error('Failed to load accounts:', e);
            accountsList.innerHTML = '<p class="status-msg error">Error loading accounts. Check console.</p>';
        } finally {
            GitHubAPI.hidePauseModal();
        }
    }

    // Initial load
    loadAccounts();

    function renderAccounts(accounts) {
        if (accounts.length === 0) {
            accountsList.innerHTML = '<p class="status-msg">No accounts found.</p>';
            return;
        }

        accountsList.innerHTML = accounts.map(acc => {
            let roleBadge = '';
            if (acc.role === 'owner') {
                roleBadge = '<span class="admin-badge" style="background: #ff4757;">OWNER</span>';
            } else if (acc.role === 'admin') {
                roleBadge = '<span class="admin-badge">ADMIN</span>';
            }

            return `
            <div class="account-card ${acc.isRuleBreaker ? 'rule-breaker' : ''}" data-id="${acc.id}">
                <div class="account-info-main">
                    <img src="${acc.pfp}" class="account-pfp">
                    <div class="account-details">
                        <h4>${acc.username} 
                            ${roleBadge}
                            ${acc.isRuleBreaker ? '<span class="rule-breaker-badge">Rule-Breaker</span>' : ''}
                        </h4>
                        <p>ID: ${acc.id} | IP: ${acc.allowedIp || 'None'}</p>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="btn-options" onclick="openAccountActions('${acc.id}', '${acc.username}', '${acc.allowedIp || ''}')">Options</button>
                </div>
            </div>
        `;}).join('');
    }

    // Search functionality
    accountSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allAccounts.filter(acc => 
            acc.username.toLowerCase().includes(query) || 
            acc.id.toString().includes(query)
        );
        renderAccounts(filtered);
    });

    // Modal logic
    window.openAccountActions = (userId, username, ip) => {
        currentEditingUserId = userId;
        currentEditingUsername = username;
        currentEditingUserIp = ip;
        const targetUserEl = document.getElementById('actions-target-user');
        if (targetUserEl) targetUserEl.innerText = username;
        
        // Developer-only check for "Role" and "Beta" tiles
        const makeAdminTile = document.getElementById('tile-make-admin');
        const makeBetaTile = document.getElementById('tile-make-beta');
        
        if (makeAdminTile && makeBetaTile) {
            if (user.id !== DEVELOPER_ID) {
                makeAdminTile.classList.add('hidden');
                makeBetaTile.classList.add('hidden');
            } else {
                makeAdminTile.classList.remove('hidden');
                makeBetaTile.classList.remove('hidden');
            }
        }
        
        if (accountActionsModal) accountActionsModal.classList.remove('hidden');

        // Disable Ban/Delete for non-rule breakers
        const acc = allAccounts.find(a => a.id === userId);
        const banTile = document.getElementById('tile-ban-ip');
        const deleteTile = document.getElementById('tile-delete-acc');

        if (acc && banTile && deleteTile) {
            // Owner and Developer are exempt from restrictions
            const isExempt = acc.role === 'owner' || acc.id === DEVELOPER_ID;
            
            if (!acc.isRuleBreaker && !isExempt && acc.role !== 'admin') {
                banTile.style.opacity = '0.3';
                banTile.style.pointerEvents = 'none';
                banTile.title = 'Only rule breakers can be banned';
                
                deleteTile.style.opacity = '0.3';
                deleteTile.style.pointerEvents = 'none';
                deleteTile.title = 'Only rule breakers can be deleted';
            } else {
                banTile.style.opacity = '1';
                banTile.style.pointerEvents = 'auto';
                banTile.title = '';
                
                deleteTile.style.opacity = '1';
                deleteTile.style.pointerEvents = 'auto';
                deleteTile.title = '';
            }
        }
    };

    setTileClick('tile-reset-ip', () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (window.openResetIp) window.openResetIp(currentEditingUserId, currentEditingUsername);
    });

    setTileClick('tile-ban-ip', () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (window.openBanIp) window.openBanIp(currentEditingUserId, currentEditingUsername, currentEditingUserIp);
    });

    setTileClick('tile-change-pw', () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (window.openChangePw) window.openChangePw(currentEditingUserId, currentEditingUsername);
    });

    setTileClick('tile-delete-acc', () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (window.openDeleteAccount) window.openDeleteAccount(currentEditingUserId, currentEditingUsername);
    });

    setTileClick('tile-get-info', () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (window.openAccountInfo) window.openAccountInfo(currentEditingUserId);
    });

    setTileClick('tile-violations', () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (window.openManageViolations) window.openManageViolations(currentEditingUserId, currentEditingUsername);
    });

    setTileClick('tile-force-logout', async () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        if (!confirm(`Force logout ${currentEditingUsername}? They will be redirected to login on their next page load.`)) return;
        
        try {
            const btn = document.getElementById('tile-force-logout');
            if (btn) btn.disabled = true;
            
            await GitHubAPI.safeUpdateFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                { forceLogout: true },
                `Admin: Forced logout for user ${currentEditingUserId}`
            );
            
            alert('Force logout signal sent successfully.');
        } catch (e) {
            alert('Failed to force logout: ' + e.message);
        } finally {
            const btn = document.getElementById('tile-force-logout');
            if (btn) btn.disabled = false;
        }
    });

    setTileClick('tile-make-admin', async () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        
        if (user.id !== DEVELOPER_ID) {
            alert('Unauthorized: Only the Developer can manage roles.');
            return;
        }

        const acc = allAccounts.find(a => a.id === currentEditingUserId);
        if (!acc) return;

        let nextRole = 'user';
        let actionLabel = 'remove admin rights from';
        
        if (acc.role === 'admin') {
            nextRole = 'owner';
            actionLabel = 'promote to owner:';
        } else if (acc.role === 'owner') {
            nextRole = 'user';
            actionLabel = 'reset to standard user:';
        } else {
            nextRole = 'admin';
            actionLabel = 'make admin:';
        }

        if (!confirm(`Are you sure you want to ${actionLabel} ${currentEditingUsername}?`)) return;

        try {
            const btn = document.getElementById('tile-make-admin');
            if (btn) btn.disabled = true;

            await GitHubAPI.safeUpdateFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                { role: nextRole },
                `Admin: Updated role to ${nextRole} for ${currentEditingUsername}`
            );

            alert(`Role updated to ${nextRole} successfully.`);
            loadAccounts();
        } catch (e) {
            alert('Failed to update role: ' + e.message);
        } finally {
            const btn = document.getElementById('tile-make-admin');
            if (btn) btn.disabled = false;
        }
    });

    setTileClick('tile-make-beta', async () => {
        if (accountActionsModal) accountActionsModal.classList.add('hidden');
        
        if (user.id !== DEVELOPER_ID) {
            alert('Unauthorized: Only the Developer can manage BETA roles.');
            return;
        }

        const acc = allAccounts.find(a => a.id === currentEditingUserId);
        if (!acc) return;

        const isCurrentlyBeta = acc.role === 'beta';
        const confirmMsg = isCurrentlyBeta 
            ? `Are you sure you want to remove BETA Tester rights from ${currentEditingUsername}?`
            : `Are you sure you want to make ${currentEditingUsername} a BETA Tester?`;

        if (!confirm(confirmMsg)) return;

        try {
            const btn = document.getElementById('tile-make-beta');
            if (btn) btn.disabled = true;

            await GitHubAPI.safeUpdateFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                { role: isCurrentlyBeta ? 'user' : 'beta' },
                `Admin: ${isCurrentlyBeta ? 'Removed' : 'Granted'} BETA Tester rights for ${currentEditingUsername}`
            );

            alert(`BETA Tester rights ${isCurrentlyBeta ? 'removed' : 'granted'} successfully.`);
            loadAccounts();
        } catch (e) {
            alert('Failed to update BETA Tester rights: ' + e.message);
        } finally {
            const btn = document.getElementById('tile-make-beta');
            if (btn) btn.disabled = false;
        }
    });

    // Action Confirmations
    const setOnSubmit = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.onsubmit = callback;
    };

    setOnSubmit('form-reset-ip', async (e) => {
        e.preventDefault();
        const ipEl = document.getElementById('new-ip');
        const newIp = ipEl ? ipEl.value.trim() : '';
        const btn = document.getElementById('btn-confirm-ip');
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Updating...';
            }
            
            await GitHubAPI.safeUpdateFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                { allowedIp: newIp || null },
                `Admin: Reset IP for user ${currentEditingUserId}`
            );
            
            alert('IP updated successfully');
            if (resetIpModal) resetIpModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to update IP: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Update IP';
            }
        }
    });

    setOnSubmit('form-change-pw', async (e) => {
        e.preventDefault();
        const pwEl = document.getElementById('new-pw');
        const newPw = pwEl ? pwEl.value.trim() : '';
        if (!newPw) return alert('Password cannot be empty');
        
        const btn = document.getElementById('btn-confirm-pw');
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Updating...';
            }
            
            await GitHubAPI.safeUpdateFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                { password: newPw },
                `Admin: Change password for user ${currentEditingUserId}`
            );
            
            alert('Password changed successfully');
            if (changePwModal) changePwModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to change password: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Change Password';
            }
        }
    });

    setTileClick('btn-confirm-ban', async () => {
        const targetIpEl = document.getElementById('ban-target-ip');
        const ip = targetIpEl ? targetIpEl.innerText : '';
        const reasonEl = document.getElementById('ban-reason');
        const reason = (reasonEl ? reasonEl.value.trim() : '') || 'No reason provided';
        if (!ip || ip === 'Unknown' || ip === 'None') return alert('No valid IP to ban');
        
        const btn = document.getElementById('btn-confirm-ban');
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Banning...';
            }
            
            const banData = {
                ip: ip,
                reason: reason,
                bannedBy: user.username,
                timestamp: Date.now()
            };

            await GitHubAPI.safeUpdateFile(
                'banned-ips.json',
                { _action: 'append', data: banData },
                `Admin: Banned IP ${ip} - Reason: ${reason} (By: ${user.username})`
            );
            
            alert(`IP ${ip} has been banned.`);
            if (banIpModal) banIpModal.classList.add('hidden');
        } catch (e) {
            alert('Failed to ban IP: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Ban This IP';
            }
        }
    });

    setTileClick('btn-confirm-unban', async () => {
        const inputEl = document.getElementById('unban-ip-input');
        const ip = inputEl ? inputEl.value.trim() : '';
        if (!ip) return alert('Please enter an IP address to unban');

        const btn = document.getElementById('btn-confirm-unban');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Unbanning...';
            }

            await GitHubAPI.safeUpdateFile(
                'banned-ips.json',
                { _action: 'remove_by_key', key: 'ip', value: ip },
                `Admin: Unbanned IP ${ip} (By: ${user.username})`
            );

            alert(`IP ${ip} has been unbanned.`);
            if (unbanIpModal) unbanIpModal.classList.add('hidden');
        } catch (e) {
            alert('Failed to unban IP: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Unban IP';
            }
        }
    });

    setTileClick('btn-logout', () => {
        localStorage.removeItem('current_user');
        GitHubAPI.hidePauseModal();
        window.location.href = '../index.html';
    });

    setTileClick('btn-confirm-delete', async () => {
        const btn = document.getElementById('btn-confirm-delete');
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Deleting...';
            }
            
            await GitHubAPI.safeDeleteFile(
                `created-news-accounts-storage/${currentEditingUserId}.json`,
                `Admin: Deleted account for user ${currentEditingUserId}`
            );
            
            alert('Account deleted successfully');
            if (deleteAccountModal) deleteAccountModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to delete account: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Delete Permanently';
            }
        }
    });

    setTileClick('btn-cancel-delete', () => { if (deleteAccountModal) deleteAccountModal.classList.add('hidden'); });
    setTileClick('btn-cancel-ban', () => { if (banIpModal) banIpModal.classList.add('hidden'); });
    setTileClick('btn-cancel-unban', () => { if (unbanIpModal) unbanIpModal.classList.add('hidden'); });
    setTileClick('btn-cancel-link-mail', () => { if (linkMailModal) linkMailModal.classList.add('hidden'); });

    // Initial Load
    loadAccounts();
});
