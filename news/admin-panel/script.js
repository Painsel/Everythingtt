const user = JSON.parse(localStorage.getItem('current_user'));
const DEVELOPER_ID = '845829137251567';

// Top-level Security Check (Backup to inline check)
if (!user || (user.role !== 'admin' && user.id !== DEVELOPER_ID)) {
    window.location.replace('../homepage/');
}

document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    document.getElementById('side-pfp').src = user.pfp;
    document.getElementById('side-username').innerText = user.username;

    const accountsList = document.getElementById('accounts-list');
    const accountSearch = document.getElementById('account-search');
    
    // Modals
    const resetIpModal = document.getElementById('reset-ip-modal');
    const changePwModal = document.getElementById('change-pw-modal');
    const deleteAccountModal = document.getElementById('delete-account-modal');
    const banIpModal = document.getElementById('ban-ip-modal');
    const accountInfoModal = document.getElementById('account-info-modal');
    const accountActionsModal = document.getElementById('account-actions-modal');
    const closeModals = document.querySelectorAll('.close-modal');
    const modals = [resetIpModal, changePwModal, deleteAccountModal, banIpModal, accountInfoModal, accountActionsModal];
    
    // Close modals when clicking outside
    window.onclick = (event) => {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    };
    
    let allAccounts = [];
    let currentEditingUserId = null;
    let currentEditingUsername = null;
    let currentEditingUserIp = null;

    // Fetch all accounts
    async function loadAccounts() {
        try {
            accountsList.innerHTML = '<p class="status-msg">Fetching all accounts from storage...</p>';
            const files = await GitHubAPI.listFiles('news/created-news-accounts-storage');
            
            const accountFiles = files.filter(f => f.name.endsWith('.json') && f.name !== '.gitkeep');
            
            allAccounts = await Promise.all(accountFiles.map(async (file) => {
                const data = await GitHubAPI.getFile(file.path);
                if (data) {
                    const account = JSON.parse(data.content);
                    account.sha = data.sha;
                    return account;
                }
                return null;
            }));

            allAccounts = allAccounts.filter(a => a !== null);
            renderAccounts(allAccounts);
        } catch (e) {
            console.error('Failed to load accounts:', e);
            accountsList.innerHTML = '<p class="status-msg error">Error loading accounts. Check console.</p>';
        }
    }

    function renderAccounts(accounts) {
        if (accounts.length === 0) {
            accountsList.innerHTML = '<p class="status-msg">No accounts found.</p>';
            return;
        }

        accountsList.innerHTML = accounts.map(acc => `
            <div class="account-card" data-id="${acc.id}">
                <div class="account-info-main">
                    <img src="${acc.pfp}" class="account-pfp">
                    <div class="account-details">
                        <h4>${acc.username} ${acc.role === 'admin' ? '<span class="admin-badge">ADMIN</span>' : ''}</h4>
                        <p>ID: ${acc.id} | IP: ${acc.allowedIp || 'None'}</p>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="btn-options" onclick="openAccountActions('${acc.id}', '${acc.username}', '${acc.allowedIp || ''}')">Options</button>
                </div>
            </div>
        `).join('');
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
        document.getElementById('actions-target-user').innerText = username;
        
        // Developer-only check for "Make Admin" and "Make BETA" tiles
        const makeAdminTile = document.getElementById('tile-make-admin');
        const makeBetaTile = document.getElementById('tile-make-beta');
        
        if (user.id !== DEVELOPER_ID) {
            makeAdminTile.classList.add('hidden');
            makeBetaTile.classList.add('hidden');
        } else {
            makeAdminTile.classList.remove('hidden');
            makeBetaTile.classList.remove('hidden');
            
            const acc = allAccounts.find(a => a.id === userId);
            
            // Update Make Admin tile
            const labelAdmin = document.getElementById('label-make-admin');
            if (acc && acc.role === 'admin') {
                labelAdmin.innerText = 'Remove Admin';
            } else {
                labelAdmin.innerText = 'Make Admin';
            }

            // Update Make BETA tile
            const labelBeta = document.getElementById('label-make-beta');
            if (acc && acc.role === 'beta') {
                labelBeta.innerText = 'Remove BETA';
            } else {
                labelBeta.innerText = 'Make BETA';
            }
        }
        
        accountActionsModal.classList.remove('hidden');
    };

    document.getElementById('tile-reset-ip').onclick = () => {
        accountActionsModal.classList.add('hidden');
        openResetIp(currentEditingUserId, currentEditingUsername);
    };

    document.getElementById('tile-ban-ip').onclick = () => {
        accountActionsModal.classList.add('hidden');
        openBanIp(currentEditingUserId, currentEditingUsername, currentEditingUserIp);
    };

    document.getElementById('tile-change-pw').onclick = () => {
        accountActionsModal.classList.add('hidden');
        openChangePw(currentEditingUserId, currentEditingUsername);
    };

    document.getElementById('tile-delete-acc').onclick = () => {
        accountActionsModal.classList.add('hidden');
        openDeleteAccount(currentEditingUserId, currentEditingUsername);
    };

    document.getElementById('tile-get-info').onclick = () => {
        accountActionsModal.classList.add('hidden');
        openAccountInfo(currentEditingUserId);
    };

    document.getElementById('tile-get-ip').onclick = () => {
        accountActionsModal.classList.add('hidden');
        const acc = allAccounts.find(a => a.id === currentEditingUserId);
        const ip = (acc && acc.allowedIp) ? acc.allowedIp : 'No IP recorded for this user.';
        
        // Create a custom styled alert or just use a standard one for now
        // Standard alert is easier for "copying" on most browsers
        alert(`User: ${currentEditingUsername}\nIP Address: ${ip}`);
    };

    document.getElementById('tile-make-admin').onclick = async () => {
        accountActionsModal.classList.add('hidden');
        
        // Final security check: Only the developer can manage admin roles
        if (user.id !== DEVELOPER_ID) {
            alert('Unauthorized: Only the Developer can manage admin roles.');
            return;
        }

        const acc = allAccounts.find(a => a.id === currentEditingUserId);
        if (!acc) return;

        const isCurrentlyAdmin = acc.role === 'admin';
        const confirmMsg = isCurrentlyAdmin 
            ? `Are you sure you want to remove admin rights from ${currentEditingUsername}?`
            : `Are you sure you want to make ${currentEditingUsername} an admin?`;

        if (!confirm(confirmMsg)) return;

        try {
            const btn = document.getElementById('tile-make-admin');
            btn.disabled = true;

            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                { role: isCurrentlyAdmin ? 'user' : 'admin' },
                `Admin: ${isCurrentlyAdmin ? 'Removed' : 'Granted'} admin rights for ${currentEditingUsername}`
            );

            alert(`Admin rights ${isCurrentlyAdmin ? 'removed' : 'granted'} successfully.`);
            loadAccounts();
        } catch (e) {
            alert('Failed to update admin rights: ' + e.message);
        } finally {
            document.getElementById('tile-make-admin').disabled = false;
        }
    };

    document.getElementById('tile-make-beta').onclick = async () => {
        accountActionsModal.classList.add('hidden');
        
        // Final security check: Only the developer can manage BETA roles
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
            btn.disabled = true;

            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                { role: isCurrentlyBeta ? 'user' : 'beta' },
                `Admin: ${isCurrentlyBeta ? 'Removed' : 'Granted'} BETA Tester rights for ${currentEditingUsername}`
            );

            alert(`BETA Tester rights ${isCurrentlyBeta ? 'removed' : 'granted'} successfully.`);
            loadAccounts();
        } catch (e) {
            alert('Failed to update BETA Tester rights: ' + e.message);
        } finally {
            document.getElementById('tile-make-beta').disabled = false;
        }
    };

    document.getElementById('tile-force-logout').onclick = async () => {
        accountActionsModal.classList.add('hidden');
        if (!confirm(`Force logout ${currentEditingUsername}? They will be redirected to login on their next page load.`)) return;
        
        try {
            const btn = document.getElementById('tile-force-logout');
            btn.disabled = true;
            
            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                { forceLogout: true },
                `Admin: Forced logout for user ${currentEditingUserId}`
            );
            
            alert('Force logout signal sent successfully.');
        } catch (e) {
            alert('Failed to force logout: ' + e.message);
        } finally {
            document.getElementById('tile-force-logout').disabled = false;
        }
    };

    window.openResetIp = (userId, username) => {
        currentEditingUserId = userId;
        document.getElementById('ip-target-user').innerText = username;
        const acc = allAccounts.find(a => a.id === userId);
        document.getElementById('new-ip').value = acc.allowedIp || '';
        resetIpModal.classList.remove('hidden');
    };

    window.openChangePw = (userId, username) => {
        currentEditingUserId = userId;
        document.getElementById('pw-target-user').innerText = username;
        document.getElementById('new-pw').value = '';
        changePwModal.classList.remove('hidden');
    };

    window.openDeleteAccount = (userId, username) => {
        currentEditingUserId = userId;
        document.getElementById('delete-target-user').innerText = username;
        deleteAccountModal.classList.remove('hidden');
    };

    window.openBanIp = (userId, username, ip) => {
        currentEditingUserId = userId;
        document.getElementById('ban-target-user').innerText = username;
        document.getElementById('ban-target-ip').innerText = ip || 'Unknown';
        banIpModal.classList.remove('hidden');
    };

    window.openAccountInfo = async (userId) => {
        const loading = document.getElementById('info-loading');
        const content = document.getElementById('info-content');
        
        loading.classList.remove('hidden');
        content.classList.add('hidden');
        accountInfoModal.classList.remove('hidden');

        try {
            // 1. Find account in local list
            const acc = allAccounts.find(a => a.id === userId);
            if (!acc) throw new Error('Account not found');

            // 2. Populate account fields
            document.getElementById('info-username').innerText = acc.username;
            document.getElementById('info-password').innerText = acc.password;
            document.getElementById('info-id').innerText = acc.id;
            document.getElementById('info-join-date').innerText = acc.joinDate ? new Date(acc.joinDate).toLocaleString() : 'N/A';
            
            // Privacy Consent Info
            const consentSpan = document.getElementById('info-privacy');
            if (acc.privacyConsent === true) {
                consentSpan.innerText = 'Accepted';
                consentSpan.style.color = '#3ba55d'; // Success green
            } else if (acc.privacyConsent === false) {
                consentSpan.innerText = 'Declined';
                consentSpan.style.color = '#ed4245'; // Danger red
            } else {
                consentSpan.innerText = 'No Choice Made (Pre-Update)';
                consentSpan.style.color = '#72767d'; // Muted grey
            }

            document.getElementById('info-ip').innerText = acc.allowedIp || 'None';

            // 3. Fetch IP details if IP exists
            if (acc.allowedIp && acc.allowedIp !== 'None') {
                try {
                    const ipRes = await fetch(`https://ipwho.is/${acc.allowedIp}`);
                    const ipData = await ipRes.json();
                    
                    if (ipData.success) {
                        document.getElementById('info-country').innerText = `${ipData.country} (${ipData.country_code})`;
                        document.getElementById('info-region').innerText = ipData.region;
                        document.getElementById('info-city').innerText = ipData.city;
                        document.getElementById('info-isp').innerText = ipData.connection.isp;
                        document.getElementById('info-org').innerText = ipData.connection.org || 'N/A';
                        document.getElementById('info-timezone').innerText = ipData.timezone.id;
                    } else {
                        throw new Error(ipData.message || 'IP lookup failed');
                    }
                } catch (e) {
                    console.warn('IP detail fetch failed:', e);
                    ['country', 'region', 'city', 'isp', 'org', 'timezone'].forEach(id => {
                        document.getElementById(`info-${id}`).innerText = 'Lookup Failed';
                    });
                }
            } else {
                ['country', 'region', 'city', 'isp', 'org', 'timezone'].forEach(id => {
                    document.getElementById(`info-${id}`).innerText = 'N/A (No IP)';
                });
            }

            loading.classList.add('hidden');
            content.classList.remove('hidden');
        } catch (e) {
            alert('Error fetching info: ' + e.message);
            accountInfoModal.classList.add('hidden');
        }
    };

    closeModals.forEach(btn => {
        btn.onclick = () => {
            resetIpModal.classList.add('hidden');
            changePwModal.classList.add('hidden');
            deleteAccountModal.classList.add('hidden');
            banIpModal.classList.add('hidden');
            accountInfoModal.classList.add('hidden');
            accountActionsModal.classList.add('hidden');
        };
    });

    document.getElementById('btn-cancel-delete').onclick = () => {
        deleteAccountModal.classList.add('hidden');
    };

    document.getElementById('btn-cancel-ban').onclick = () => {
        banIpModal.classList.add('hidden');
    };

    // Action Confirmations
    document.getElementById('btn-confirm-delete').onclick = async () => {
        const btn = document.getElementById('btn-confirm-delete');
        try {
            btn.disabled = true;
            btn.innerText = 'Deleting...';
            
            await GitHubAPI.safeDeleteFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                `Admin: Deleted account for user ${currentEditingUserId}`
            );
            
            alert('Account deleted successfully');
            deleteAccountModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to delete account: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Delete Permanently';
        }
    };

    document.getElementById('form-reset-ip').onsubmit = async (e) => {
        e.preventDefault();
        const newIp = document.getElementById('new-ip').value.trim();
        const btn = document.getElementById('btn-confirm-ip');
        
        try {
            btn.disabled = true;
            btn.innerText = 'Updating...';
            
            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                { allowedIp: newIp || null },
                `Admin: Reset IP for user ${currentEditingUserId}`
            );
            
            alert('IP updated successfully');
            resetIpModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to update IP: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Update IP';
        }
    };

    document.getElementById('form-change-pw').onsubmit = async (e) => {
        e.preventDefault();
        const newPw = document.getElementById('new-pw').value.trim();
        if (!newPw) return alert('Password cannot be empty');
        
        const btn = document.getElementById('btn-confirm-pw');
        
        try {
            btn.disabled = true;
            btn.innerText = 'Updating...';
            
            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                { password: newPw },
                `Admin: Change password for user ${currentEditingUserId}`
            );
            
            alert('Password changed successfully');
            changePwModal.classList.add('hidden');
            loadAccounts();
        } catch (e) {
            alert('Failed to change password: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Change Password';
        }
    };

    document.getElementById('btn-confirm-ban').onclick = async () => {
        const ip = document.getElementById('ban-target-ip').innerText;
        if (!ip || ip === 'Unknown' || ip === 'None') return alert('No valid IP to ban');
        
        const btn = document.getElementById('btn-confirm-ban');
        
        try {
            btn.disabled = true;
            btn.innerText = 'Banning...';
            
            await GitHubAPI.safeUpdateFile(
                'news/banned-ips.json',
                { _action: 'append', data: ip },
                `Admin: Banned IP ${ip} (Associated with user ${currentEditingUserId})`
            );
            
            alert(`IP ${ip} has been banned.`);
            banIpModal.classList.add('hidden');
        } catch (e) {
            alert('Failed to ban IP: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Ban This IP';
        }
    };

    // Logout
    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('current_user');
        window.location.href = '../index.html';
    };

    // Initial Load
    loadAccounts();
});
