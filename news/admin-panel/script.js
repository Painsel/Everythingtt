const ADMIN_ID = '382156063438888';
const user = JSON.parse(localStorage.getItem('current_user'));

// Top-level Security Check (Backup to inline check)
if (!user || user.id !== ADMIN_ID) {
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
    const accountActionsModal = document.getElementById('account-actions-modal');
    const closeModals = document.querySelectorAll('.close-modal');
    
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
                        <h4>${acc.username}</h4>
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

    closeModals.forEach(btn => {
        btn.onclick = () => {
            resetIpModal.classList.add('hidden');
            changePwModal.classList.add('hidden');
            deleteAccountModal.classList.add('hidden');
            banIpModal.classList.add('hidden');
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

    document.getElementById('btn-confirm-ip').onclick = async () => {
        const newIp = document.getElementById('new-ip').value.trim();
        const btn = document.getElementById('btn-confirm-ip');
        
        try {
            btn.disabled = true;
            btn.innerText = 'Updating...';
            
            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                (content) => {
                    const acc = JSON.parse(content);
                    acc.allowedIp = newIp || null;
                    return JSON.stringify(acc);
                },
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

    document.getElementById('btn-confirm-pw').onclick = async () => {
        const newPw = document.getElementById('new-pw').value.trim();
        if (!newPw) return alert('Password cannot be empty');
        
        const btn = document.getElementById('btn-confirm-pw');
        
        try {
            btn.disabled = true;
            btn.innerText = 'Updating...';
            
            await GitHubAPI.safeUpdateFile(
                `news/created-news-accounts-storage/${currentEditingUserId}.json`,
                (content) => {
                    const acc = JSON.parse(content);
                    acc.password = newPw;
                    return JSON.stringify(acc);
                },
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
            
            // 1. Fetch current ban list
            let banListData = await GitHubAPI.getFile('news/banned-ips.json');
            let bannedIps = [];
            let sha = null;
            
            if (banListData) {
                bannedIps = JSON.parse(banListData.content);
                sha = banListData.sha;
            }
            
            if (bannedIps.includes(ip)) {
                alert('This IP is already banned');
                banIpModal.classList.add('hidden');
                return;
            }
            
            // 2. Add to list
            bannedIps.push(ip);
            
            // 3. Update file
            await GitHubAPI.updateFile(
                'news/banned-ips.json',
                JSON.stringify(bannedIps),
                `Admin: Banned IP ${ip} (Associated with user ${currentEditingUserId})`,
                sha
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
