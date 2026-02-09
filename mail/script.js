import { GitHubAPI } from '../news/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('mail-login-form');
    const signupForm = document.getElementById('mail-signup-form');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const authDesc = document.getElementById('auth-desc');

    // Tab Switching
    tabLogin.onclick = () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        authDesc.innerText = 'Enter your mail credentials to continue';
    };

    tabSignup.onclick = () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        authDesc.innerText = 'Create your official @ett.mail address';
    };

    // Handle Registration (Sign Up)
    signupForm.onsubmit = async (e) => {
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
            const existingAccounts = await GitHubAPI.getFolderContents('news/mail-accounts-storage/email-map');
            const emailExists = existingAccounts.some(f => f.name === `${prefix}.json`);
            if (emailExists) {
                alert('This email address is already taken.');
                return;
            }

            // Generate unique mailbox ID
            const mailboxId = 'ettm_' + Math.random().toString(36).substr(2, 9);

            const mailAccountData = {
                userId: user.id,
                email: fullEmail,
                password: password,
                mailboxId: mailboxId,
                createdAt: new Date().toISOString()
            };

            // Save account info
            await GitHubAPI.safeUpdateFile(
                `news/mail-accounts-storage/${user.id}.json`,
                mailAccountData,
                `Mail: Created account for ${user.username} (${fullEmail})`
            );

            // Save email mapping
            await GitHubAPI.safeUpdateFile(
                `news/mail-accounts-storage/email-map/${prefix}.json`,
                { mailboxId: mailboxId, userId: user.id },
                `Mail: Email mapping for ${fullEmail}`
            );

            alert('EverythingTT Mail created successfully! You can now login.');
            tabLogin.click(); // Switch to login tab
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
            const mapData = await GitHubAPI.getFile(`news/mail-accounts-storage/email-map/${prefix}.json`);
            if (!mapData) {
                alert('Mail account not found.');
                return;
            }
            const map = JSON.parse(atob(mapData.content));

            const accData = await GitHubAPI.getFile(`news/mail-accounts-storage/${map.userId}.json`);
            const acc = JSON.parse(atob(accData.content));

            if (acc.password === password) {
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