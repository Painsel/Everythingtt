import { GitHubAPI } from '../../utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    let user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../../index.html';
        return;
    }

    // Sidebar and User UI
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

        if (u.role === 'admin' || u.role === 'owner') {
            document.getElementById('admin-nav-item').classList.remove('hidden');
        }
    };
    updateUIWithStatus(user);

    // Sidebar Toggle
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Form Logic
    const appealForm = document.getElementById('appeal-form');
    const appealSubject = document.getElementById('appeal-subject');
    const subSubjectContainer = document.getElementById('sub-subject-container');
    const appealSubSubject = document.getElementById('appeal-sub-subject');
    const imageInput = document.getElementById('image-input');
    const uploadArea = document.getElementById('image-upload-area');
    const previewGrid = document.getElementById('image-preview-grid');
    const placeholder = document.getElementById('upload-placeholder');
    
    let uploadedImages = [];

    // Toggle sub-subject
    appealSubject.addEventListener('change', () => {
        if (appealSubject.value === 'rule-violation') {
            subSubjectContainer.classList.remove('hidden');
            appealSubSubject.required = true;
        } else {
            subSubjectContainer.classList.add('hidden');
            appealSubSubject.required = false;
        }
    });

    // Handle Image Uploads
    uploadArea.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (uploadedImages.length + files.length > 3) {
            alert('You can only upload up to 3 images.');
            return;
        }

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                uploadedImages.push(base64);
                renderPreviews();
            };
            reader.readAsDataURL(file);
        }
        imageInput.value = ''; // Reset for next selection
    });

    function renderPreviews() {
        previewGrid.innerHTML = '';
        if (uploadedImages.length > 0) {
            placeholder.classList.add('hidden');
        } else {
            placeholder.classList.remove('hidden');
        }

        uploadedImages.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${img}" alt="Preview">
                <button type="button" class="remove-preview" data-index="${index}">&times;</button>
            `;
            previewGrid.appendChild(div);
        });

        // Add click listeners to remove buttons
        document.querySelectorAll('.remove-preview').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                uploadedImages.splice(idx, 1);
                renderPreviews();
            };
        });
    }

    // Form Submission
    appealForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (uploadedImages.length === 0) {
            alert('Please upload at least one screenshot as evidence.');
            return;
        }

        const btn = document.getElementById('btn-submit-appeal');
        btn.disabled = true;
        btn.innerText = 'Submitting...';

        try {
            const userId = document.getElementById('user-id').value.trim();
            const subject = appealSubject.value;
            const subSubject = appealSubSubject.value;
            const content = document.getElementById('appeal-content').value.trim();
            
            const formId = `form_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const formData = {
                id: formId,
                timestamp: new Date().toISOString(),
                userId: userId,
                submittedBy: user.id,
                username: user.username,
                subject: subject,
                subSubject: subSubject,
                content: content,
                images: uploadedImages, // Array of base64 strings
                status: 'pending'
            };

            await GitHubAPI.safeUpdateFile(
                `news/support-forms-storage/${formId}.json`,
                formData,
                `Support: New appeal from ${user.username} (${formId})`
            );

            alert('Your appeal has been submitted successfully. Our team will review it soon.');
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Failed to submit appeal: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Submit Appeal';
        }
    });

    // Logout logic
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('current_user');
        window.location.href = '../../index.html';
    });
});
