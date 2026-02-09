import { GitHubAPI } from '../news/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const accessForm = document.getElementById('mail-access-form');
    const signupFields = document.getElementById('signup-fields');
    const accessFields = document.getElementById('access-fields');
    const emailDisplay = document.getElementById('existing-email-display');
    const btnEnterInbox = document.getElementById('btn-enter-inbox');

    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        alert('You must be logged into EverythingTT News to access Mail.');
        window.location.href = '../news/index.html';
        return;
    }

    let currentMailAcc = null;

    // Check if account already exists
    try {
        const accData = await GitHubAPI.getFile(`news/mail-accounts-storage/${user.id}.json`);
        if (accData) {
            currentMailAcc = JSON.parse(atob(accData.content));
            
            // Show access fields
            signupFields.classList.add('hidden');
            accessFields.classList.remove('hidden');
            emailDisplay.innerText = currentMailAcc.email;
        }
    } catch (e) {
        // No account yet, keep signup fields visible
        console.log('No mail account found for user, showing signup.');
    }

    // Handle Registration (Sign Up)
    accessForm.onsubmit = async (e) => {
        e.preventDefault();
        const prefix = document.getElementById('new-mail-prefix').value.trim().toLowerCase();
        const fullEmail = `${prefix}@ett.mail`;

        try {
            // Check if email already exists in the map
            const existingMaps = await GitHubAPI.getFolderContents('news/mail-accounts-storage/email-map');
            const emailExists = existingMaps.some(f => f.name === `${prefix}.json`);
            if (emailExists) {
                alert('This email address is already taken.');
                return;
            }

            const mailboxId = 'ettm_' + Math.random().toString(36).substr(2, 9);
            const mailAccountData = {
                userId: user.id,
                email: fullEmail,
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

            sessionStorage.setItem('current_mail_acc', JSON.stringify(mailAccountData));
            window.location.href = 'main/index.html';
        } catch (error) {
            alert('Failed to create mailbox: ' + error.message);
        }
    };

    // Handle Enter Inbox
    btnEnterInbox.onclick = () => {
        if (currentMailAcc) {
            sessionStorage.setItem('current_mail_acc', JSON.stringify(currentMailAcc));
            window.location.href = 'main/index.html';
        }
    };
});