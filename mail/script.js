document.addEventListener('DOMContentLoaded', async () => {
    const GitHubAPI = window.GitHubAPI;
    const accessForm = document.getElementById('mail-access-form');
    const signupFields = document.getElementById('signup-fields');
    const accessFields = document.getElementById('access-fields');
    const emailDisplay = document.getElementById('existing-email-display');
    const btnEnterInbox = document.getElementById('btn-enter-inbox');
    const linkedContainer = document.getElementById('linked-emails-container');
    const linkedList = document.getElementById('linked-emails-list');

    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        alert('You must be logged into EverythingTT News to access Mail.');
        window.location.href = '../news/index.html';
        return;
    }

    let currentMailAcc = null;

    // Check if account already exists
    try {
        const accData = await GitHubAPI.getFile(`mail-accounts-storage/${user.id}.json`);
        if (accData) {
            currentMailAcc = GitHubAPI.safeParse(accData.content);
            if (currentMailAcc) {
                // Show access fields
                signupFields.classList.add('hidden');
                accessFields.classList.remove('hidden');
                emailDisplay.innerText = currentMailAcc.email;

                // Handle multiple linked emails
                if (currentMailAcc.linkedEmails && currentMailAcc.linkedEmails.length > 0) {
                    linkedContainer.classList.remove('hidden');
                    renderLinkedEmails();
                }
            }
        }
    } catch (e) {
        // No account yet, keep signup fields visible
        console.log('No mail account found for user, showing signup.');
    }

    function renderLinkedEmails() {
        if (!currentMailAcc || !currentMailAcc.linkedEmails) return;
        
        linkedList.innerHTML = '';
        
        // Add the primary email if not in linked list
        const allEmails = [...currentMailAcc.linkedEmails];
        const primaryInLinked = allEmails.some(e => e.email === currentMailAcc.email);
        if (!primaryInLinked) {
            allEmails.unshift({
                email: currentMailAcc.email,
                mailboxId: currentMailAcc.mailboxId
            });
        }

        allEmails.forEach(acc => {
            const div = document.createElement('div');
            div.className = `linked-email-item ${acc.email === currentMailAcc.email ? 'active' : ''}`;
            div.innerText = acc.email;
            div.onclick = () => {
                // Switch primary email
                currentMailAcc.email = acc.email;
                currentMailAcc.mailboxId = acc.mailboxId;
                emailDisplay.innerText = acc.email;
                renderLinkedEmails();
                
                // Update session storage for immediate entry
                sessionStorage.setItem('current_mail_acc', JSON.stringify(currentMailAcc));
                
                // Save the switch if we want it to persist as primary
                GitHubAPI.safeUpdateFile(
                    `mail-accounts-storage/${user.id}.json`,
                    currentMailAcc,
                    `Mail: User switched primary email to ${acc.email}`
                );
            };
            linkedList.appendChild(div);
        });
    }

    // Handle Registration (Sign Up)
    accessForm.onsubmit = async (e) => {
        e.preventDefault();
        const prefix = document.getElementById('new-mail-prefix').value.trim().toLowerCase();
        const fullEmail = `${prefix}@ett.mail`;

        try {
            // Check if email already exists in the map
            const existingMaps = await GitHubAPI.getFolderContents('mail-accounts-storage/email-map');
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
                createdAt: new Date().toISOString(),
                linkedEmails: []
            };

            // Save account info
            await GitHubAPI.safeUpdateFile(
                `mail-accounts-storage/${user.id}.json`,
                mailAccountData,
                `Mail: Created account for ${user.username} (${fullEmail})`
            );

            // Save email mapping
            await GitHubAPI.safeUpdateFile(
                `mail-accounts-storage/email-map/${prefix}.json`,
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