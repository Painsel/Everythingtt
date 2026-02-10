document.addEventListener('DOMContentLoaded', async () => {
    const GitHubAPI = window.GitHubAPI;
    const mailAcc = JSON.parse(sessionStorage.getItem('current_mail_acc'));
    if (!mailAcc) {
        window.location.href = '../index.html';
        return;
    }

    // UI Elements
    document.getElementById('mail-display-address').innerText = mailAcc.email;
    const mailList = document.getElementById('mail-list');
    const folderTitle = document.getElementById('folder-title');
    const mailCount = document.getElementById('mail-count');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const btnCompose = document.getElementById('btn-compose');
    const composeModal = document.getElementById('compose-modal');
    const viewMailModal = document.getElementById('view-mail-modal');
    const composeForm = document.getElementById('compose-form');

    let currentFolder = 'incoming';
    let allMessages = [];

    // Sidebar Logic
    sidebarToggle.onclick = () => sidebar.classList.toggle('collapsed');

    // Folder Navigation
    document.querySelectorAll('.nav-item[data-folder]').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentFolder = item.dataset.folder;
            folderTitle.innerText = currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1);
            renderMail();
        };
    });

    // Load Mail
    async function loadMail() {
        mailList.innerHTML = '<div class="loading-state">Syncing with critical storage...</div>';
        try {
            // Check if folder exists by listing contents
            let files = [];
            try {
                files = await GitHubAPI.getFolderContents(`news/mail-storage/${mailAcc.mailboxId}`);
            } catch (e) {
                // Folder might not exist yet if no mail sent
                files = [];
            }
            
            const jsonFiles = files.filter(f => f.name.endsWith('.json'));
            const promises = jsonFiles.map(f => GitHubAPI.getFile(f.path));
            const results = await Promise.all(promises);
            allMessages = results.map(r => JSON.parse(r.content));
            
            // Sort by date newest first
            allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            renderMail();
        } catch (error) {
            mailList.innerHTML = `<div class="error-state">Error loading mail: ${error.message}</div>`;
        }
    }

    function renderMail() {
        const filtered = allMessages.filter(m => m.type === currentFolder);
        mailList.innerHTML = '';
        mailCount.innerText = `${filtered.length} messages`;

        if (filtered.length === 0) {
            mailList.innerHTML = `<div class="empty-state">No messages in ${currentFolder}.</div>`;
            return;
        }

        filtered.forEach(msg => {
            const isExternal = msg.sender && !msg.sender.includes('@ett.mail') && !msg.sender.includes('EverythingTT');
            const isOfficialDiscord = msg.sender && (msg.sender.endsWith('@discord.com') || msg.sender.endsWith('@m.discord.com'));
            const isVerification = msg.subject && (msg.subject.toLowerCase().includes('verify') || msg.subject.toLowerCase().includes('verification') || msg.subject.toLowerCase().includes('code'));
            
            const item = document.createElement('div');
            item.className = `mail-item ${!msg.isRead && msg.type === 'incoming' ? 'unread' : ''}`;
            
            let badges = '';
            if (isOfficialDiscord) badges += '<span class="official-tag discord">Discord Official</span>';
            else if (isExternal) badges += '<span class="external-tag">External</span>';
            if (isVerification) badges += '<span class="verify-tag">Verification</span>';

            item.innerHTML = `
                <div class="mail-sender">
                    <span class="sender-name">${msg.sender}</span>
                    <div class="mail-badges">${badges}</div>
                </div>
                <div class="mail-subject-preview">${msg.subject}</div>
                <div class="mail-date">${new Date(msg.timestamp).toLocaleDateString()}</div>
            `;
            item.onclick = () => openMail(msg);
            mailList.appendChild(item);
        });
    }

    async function openMail(msg) {
        if (msg.type === 'draft') {
            document.getElementById('compose-to').value = msg.recipientId || '';
            document.getElementById('compose-subject').value = msg.subject === '(No Subject)' ? '' : msg.subject;
            document.getElementById('compose-body').value = msg.content || '';
            composeModal.classList.remove('hidden');
            return;
        }

        const content = document.getElementById('mail-view-content');
        let displayContent = msg.htmlContent || msg.content.replace(/\n/g, '<br>');
        
        // Auto-highlight 6-digit verification codes
        const codeMatch = msg.content.match(/\b\d{6}\b/);
        if (codeMatch) {
            const code = codeMatch[0];
            displayContent = `<div class="verification-code-highlight">
                <span class="label">Detected Verification Code:</span>
                <span class="code">${code}</span>
            </div>` + displayContent;
        }

        content.innerHTML = `
            <div class="mail-view-header">
                <h2>${msg.subject}</h2>
                <div class="mail-view-meta">
                    <div><strong>From:</strong> ${msg.sender}</div>
                    <div><strong>Date:</strong> ${new Date(msg.timestamp).toLocaleString()}</div>
                </div>
            </div>
            <div class="mail-view-body">${displayContent}</div>
        `;

        if (!msg.isRead && msg.type === 'incoming') {
            msg.isRead = true;
            await GitHubAPI.safeUpdateFile(
                `news/mail-storage/${mailAcc.mailboxId}/${msg.id}.json`,
                msg,
                `Mail: Mark as read ${msg.id}`
            );
            renderMail(); // Update UI
        }

        viewMailModal.classList.remove('hidden');
    }

    // Compose Logic
    btnCompose.onclick = () => {
        composeForm.reset();
        composeModal.classList.remove('hidden');
    };
    
    document.getElementById('btn-save-draft').onclick = async () => {
        const to = document.getElementById('compose-to').value.trim();
        const subject = document.getElementById('compose-subject').value.trim();
        const body = document.getElementById('compose-body').value.trim();

        if (!subject && !body) {
            alert('Please enter at least a subject or body to save a draft.');
            return;
        }

        try {
            const mailId = `draft_${Date.now()}`;
            const mailData = {
                id: mailId,
                sender: mailAcc.email,
                senderId: mailAcc.userId,
                recipientId: to,
                subject: subject || '(No Subject)',
                content: body,
                timestamp: new Date().toISOString(),
                type: 'draft',
                isRead: true
            };

            await GitHubAPI.safeUpdateFile(
                `news/mail-storage/${mailAcc.mailboxId}/${mailId}.json`,
                mailData,
                `Mail: Saved draft ${mailId}`
            );

            alert('Draft saved successfully!');
            composeModal.classList.add('hidden');
            composeForm.reset();
            loadMail();
        } catch (error) {
            alert('Failed to save draft: ' + error.message);
        }
    };
    
    composeForm.onsubmit = async (e) => {
        e.preventDefault();
        const to = document.getElementById('compose-to').value.trim();
        const subject = document.getElementById('compose-subject').value.trim();
        const body = document.getElementById('compose-body').value.trim();

        try {
            // Find recipient's mailbox ID
            let recipientMailboxId = null;
            let recipientEmail = to;
            let isExternal = false;

            if (to.includes('@')) {
                if (to.includes('@ett.mail')) {
                    const prefix = to.split('@')[0];
                    const mapData = await GitHubAPI.getFile(`news/mail-accounts-storage/email-map/${prefix}.json`);
                    if (mapData) {
                        const map = JSON.parse(mapData.content);
                        recipientMailboxId = map.mailboxId;
                    }
                } else {
                    // External Email Address
                    isExternal = true;
                    recipientEmail = to;
                }
            } else {
                // Assume User ID
                const accData = await GitHubAPI.getFile(`news/mail-accounts-storage/${to}.json`);
                if (accData) {
                    const acc = JSON.parse(accData.content);
                    recipientMailboxId = acc.mailboxId;
                    recipientEmail = acc.email;
                }
            }

            if (!recipientMailboxId && !isExternal) {
                alert('Recipient not found. Please check the Email or User ID.');
                return;
            }

            const mailId = `msg_${Date.now()}`;
            const mailData = {
                id: mailId,
                sender: mailAcc.email,
                senderId: mailAcc.userId,
                recipientId: to,
                subject: subject,
                content: body,
                timestamp: new Date().toISOString(),
                isRead: false
            };

            // 1. Save to sender's Outgoing
            await GitHubAPI.safeUpdateFile(
                `news/mail-storage/${mailAcc.mailboxId}/${mailId}.json`,
                { ...mailData, type: 'outgoing' },
                `Mail: Sent message ${mailId}`
            );

            // 2. Handle delivery
            if (isExternal) {
                // Save to global relay queue for the backend to pick up and send to the internet
                await GitHubAPI.safeUpdateFile(
                    `news/mail-relay/queue/${mailId}.json`,
                    { ...mailData, status: 'queued' },
                    `Mail: Queued external relay to ${to}`
                );
            } else {
                // Save to internal recipient's Incoming
                await GitHubAPI.safeUpdateFile(
                    `news/mail-storage/${recipientMailboxId}/${mailId}.json`,
                    { ...mailData, type: 'incoming' },
                    `Mail: Received message ${mailId}`
                );
            }

            alert(isExternal ? 'Mail queued for global delivery!' : 'Mail sent successfully!');
            composeModal.classList.add('hidden');
            composeForm.reset();
            loadMail();
        } catch (error) {
            alert('Failed to send mail: ' + error.message);
        }
    };

    // Global Close Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            composeModal.classList.add('hidden');
            viewMailModal.classList.add('hidden');
        };
    });

    document.getElementById('btn-refresh-mail').onclick = loadMail;

    loadMail();
});