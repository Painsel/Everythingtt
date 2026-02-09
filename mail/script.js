import { GitHubAPI } from '../news/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('mail-login-form');
    const createMailForm = document.getElementById('create-mail-form');
    const createMailModal = document.getElementById('create-mail-modal');
    const linkCreateMail = document.getElementById('link-create-mail');
    const closeModal = document.querySelector('.close-modal');

    // Show/Hide Modal
    linkCreateMail.onclick = (e) => {
        e.preventDefault();
        createMailModal.classList.remove('hidden');
    };
    closeModal.onclick = () => createMailModal.classList.add('hidden');

    // Handle Registration
    createMailForm.onsubmit = async (e) => {
        e.preventDefault();
        const prefix = document.getElementById('new-mail-prefix').value.trim().toLowerCase();
        const password = document.getElementById('new-mail-password').value;
        const fullEmail = `${prefix}@ett.mail`;

        const user = JSON.parse(localStorage.getItem('current_user'));
        if (!user) {
            alert('You must be logged into EverythingTT News to create a mail account.');
            return;
        }

        try {
            // Check if email already exists
            const existingAccounts = await GitHubAPI.getFolderContents('news/mail-accounts-storage');
            const emailExists = existingAccounts.some(f => f.name === `${prefix}.json`);
            if (emailExists) {
                alert('This email address is already taken.');
                return;
            }

            // Generate unique mailbox ID (internal folder name)
            const mailboxId = 'ettm_' + Math.random().toString(36).substr(2, 9);

            const mailAccountData = {
                userId: user.id,
                email: fullEmail,
                password: password, // In a real app, this would be hashed
                mailboxId: mailboxId,
                createdAt: new Date().toISOString()
            };

            // Save account info (mapped by News User ID for easy lookup by Admin)
            await GitHubAPI.safeUpdateFile(
                `news/mail-accounts-storage/${user.id}.json`,
                mailAccountData,
                `Mail: Created account for ${user.username} (${fullEmail})`
            );

            // Also save a mapping by email for login lookup
            await GitHubAPI.safeUpdateFile(
                `news/mail-accounts-storage/email-map/${prefix}.json`,
                { mailboxId: mailboxId, userId: user.id },
                `Mail: Email mapping for ${fullEmail}`
            );

            alert('EverythingTT Mail created successfully! You can now login.');
            createMailModal.classList.add('hidden');
        } catch (error) {
            alert('Failed to create mail: ' + error.message);
        }
    };

    // Handle Login
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('mail-email').value.trim().toLowerCase();
        const password = document.getElementById('mail-password').value;
        const prefix = email.split('@')[0];

        try {
            // Find mapping by email
            const mapData = await GitHubAPI.getFile(`news/mail-accounts-storage/email-map/${prefix}.json`);
            if (!mapData) {
                alert('Mail account not found.');
                return;
            }
            const map = JSON.parse(atob(mapData.content));

            // Get full account data
            const accData = await GitHubAPI.getFile(`news/mail-accounts-storage/${map.userId}.json`);
            const acc = JSON.parse(atob(accData.content));

            if (acc.password === password) {
                // Store mail session
                sessionStorage.setItem('current_mail_acc', JSON.stringify(acc));
                window.location.href = 'main/index.html';
            } else {
                alert('Incorrect password.');
            }
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    };
});