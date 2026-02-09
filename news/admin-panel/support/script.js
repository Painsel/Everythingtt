import { GitHubAPI } from '../../utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    let user = JSON.parse(localStorage.getItem('current_user'));
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
        window.location.href = '../../homepage/index.html';
        return;
    }

    // Standard sidebar/user UI
    const updateUIWithStatus = (u) => {
        const isGuest = u.isGuest === true;
        const statusIconName = isGuest ? 'Offline.png' : ((u.statusType === 'dnd') ? 'DoNotDisturb.png' : (u.status === 'idle' ? 'Idle.png' : (u.status === 'online' ? 'Online.png' : 'Offline.png')));
        const iconPath = GitHubAPI.getStatusIconPath(statusIconName);

        document.getElementById('side-pfp').src = u.pfp;
        document.getElementById('side-username').innerText = u.username;
        document.getElementById('side-status-icon').style.backgroundImage = `url('${iconPath}')`;
        
        const sideBubble = document.getElementById('side-status-bubble');
        if (u.statusMsg) {
            sideBubble.innerText = u.statusMsg;
            sideBubble.style.display = 'block';
        } else {
            sideBubble.style.display = 'none';
        }
    };
    updateUIWithStatus(user);

    // Sidebar Toggle
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Support Logic
    let allForms = [];
    let currentFilter = 'pending';
    let currentViewingForm = null;

    const formsList = document.getElementById('forms-list');
    const viewModal = document.getElementById('view-form-modal');
    const closeModal = document.querySelector('.close-modal');
    const btnAccept = document.getElementById('btn-accept-form');
    const btnReject = document.getElementById('btn-reject-form');

    async function loadForms() {
        formsList.innerHTML = '<div class="loading-state">Loading support forms...</div>';
        try {
            const files = await GitHubAPI.getFolderContents('news/support-forms-storage');
            const jsonFiles = files.filter(f => f.name.endsWith('.json'));
            
            const promises = jsonFiles.map(f => GitHubAPI.getFile(f.path));
            allForms = await Promise.all(promises);
            
            // Sort by timestamp (newest first)
            allForms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            renderForms();
        } catch (error) {
            console.error('Failed to load forms:', error);
            formsList.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
        }
    }

    function renderForms() {
        const filtered = allForms.filter(f => f.status === currentFilter);
        formsList.innerHTML = '';

        if (filtered.length === 0) {
            formsList.innerHTML = `<div class="empty-state">No ${currentFilter} forms found.</div>`;
            return;
        }

        filtered.forEach(form => {
            const card = document.createElement('div');
            card.className = 'form-card';
            card.innerHTML = `
                <div class="form-info-main">
                    <h4>${form.subject === 'rule-violation' ? 'Rule Violation' : 'IP Ban'} Appeal</h4>
                    <div class="form-meta">
                        <span>👤 ${form.username}</span>
                        <span>🆔 ${form.userId}</span>
                        <span>📅 ${new Date(form.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                <div class="form-status">
                    <span class="form-status-badge status-${form.status}">${form.status}</span>
                </div>
            `;
            card.onclick = () => openFormModal(form);
            formsList.appendChild(card);
        });
    }

    function openFormModal(form) {
        currentViewingForm = form;
        const details = document.getElementById('modal-form-details');
        
        details.innerHTML = `
            <div class="detail-header">
                <h2>${form.subject === 'rule-violation' ? 'Rule Violation' : 'IP Ban'} Appeal</h2>
                <p>Form ID: ${form.id}</p>
            </div>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>User ID</label>
                    <span>${form.userId}</span>
                </div>
                <div class="detail-item">
                    <label>Submitted By</label>
                    <span>${form.username} (${form.submittedBy})</span>
                </div>
                <div class="detail-item">
                    <label>Timestamp</label>
                    <span>${new Date(form.timestamp).toLocaleString()}</span>
                </div>
                ${form.subSubject ? `
                <div class="detail-item">
                    <label>Category</label>
                    <span>${form.subSubject === 'article' ? 'Article Violation' : 'Account/Friend Violation'}</span>
                </div>` : ''}
            </div>
            <div class="detail-content">${form.content}</div>
            <div class="detail-images">
                ${form.images.map(img => `<img src="${img}" alt="Evidence" onclick="window.open('${img}')">`).join('')}
            </div>
        `;

        const actions = document.getElementById('modal-form-actions');
        if (form.status === 'pending') {
            actions.classList.remove('hidden');
        } else {
            actions.classList.add('hidden');
        }

        viewModal.classList.remove('hidden');
    }

    // Action handlers
    btnAccept.onclick = () => handleFormAction('accepted');
    btnReject.onclick = () => handleFormAction('rejected');

    async function handleFormAction(status) {
        if (!currentViewingForm) return;
        
        const confirmMsg = `Are you sure you want to ${status} this appeal?`;
        if (!confirm(confirmMsg)) return;

        btnAccept.disabled = true;
        btnReject.disabled = true;

        try {
            const updatedForm = { ...currentViewingForm, status: status, processedBy: user.id, processedAt: new Date().toISOString() };
            
            await GitHubAPI.safeUpdateFile(
                `news/support-forms-storage/${currentViewingForm.id}.json`,
                updatedForm,
                `Support: ${status.toUpperCase()} appeal ${currentViewingForm.id} by ${user.username}`
            );

            alert(`Appeal ${status} successfully.`);
            viewModal.classList.add('hidden');
            loadForms();
        } catch (error) {
            alert('Action failed: ' + error.message);
        } finally {
            btnAccept.disabled = false;
            btnReject.disabled = false;
        }
    }

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.status;
            renderForms();
        };
    });

    closeModal.onclick = () => viewModal.classList.add('hidden');
    document.getElementById('btn-refresh-forms').onclick = loadForms;
    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('current_user');
        window.location.href = '../../index.html';
    };

    loadForms();
});
