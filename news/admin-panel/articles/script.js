document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('current_user'));
    
    // UI Elements
    document.getElementById('side-pfp').src = user.pfp;
    document.getElementById('side-username').innerText = user.username;

    const articlesList = document.getElementById('articles-list');
    const articleSearch = document.getElementById('article-search');
    const deleteModal = document.getElementById('delete-article-modal');
    const closeModal = document.querySelector('.close-modal');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');

    let allArticles = [];
    let articleToDelete = null;

    // Load Articles
    async function loadArticles() {
        try {
            articlesList.innerHTML = '<p class="status-msg">Fetching articles from storage...</p>';
            const files = await GitHubAPI.listFiles('news/created-articles-storage');
            
            const articleFiles = files.filter(f => f.name.endsWith('.json') && f.name !== '.gitkeep');
            
            allArticles = await Promise.all(articleFiles.map(async (file) => {
                const data = await GitHubAPI.getFile(file.path);
                if (data) {
                    try {
                        const article = JSON.parse(data.content);
                        article.sha = data.sha;
                        article.filePath = file.path;
                        return article;
                    } catch (e) {
                        console.warn('Failed to parse article:', file.path);
                        return null;
                    }
                }
                return null;
            }));

            allArticles = allArticles.filter(a => a !== null).sort((a, b) => {
                return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
            });

            renderArticles(allArticles);
        } catch (e) {
            console.error('Failed to load articles:', e);
            articlesList.innerHTML = '<p class="status-msg error">Error loading articles. Check console.</p>';
        }
    }

    function renderArticles(articles) {
        if (articles.length === 0) {
            articlesList.innerHTML = '<p class="status-msg">No articles found.</p>';
            return;
        }

        articlesList.innerHTML = articles.map(art => `
            <div class="article-card">
                <div class="article-info-main">
                    <h4 class="article-title">${art.title || 'Untitled Article'}</h4>
                    <div class="article-meta">
                        <span><b>ID:</b> ${art.id}</span>
                        <span><b>Author:</b> ${art.authorName || 'Unknown'} (${art.authorId})</span>
                        <span><b>Date:</b> ${art.timestamp ? new Date(art.timestamp).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
                <div class="article-actions">
                    <button class="btn-delete" onclick="openDeleteModal('${art.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Search functionality
    articleSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allArticles.filter(art => 
            (art.title && art.title.toLowerCase().includes(query)) || 
            (art.id && art.id.toString().includes(query)) ||
            (art.authorName && art.authorName.toLowerCase().includes(query)) ||
            (art.authorId && art.authorId.toString().includes(query))
        );
        renderArticles(filtered);
    });

    // Modal logic
    window.openDeleteModal = (articleId) => {
        const art = allArticles.find(a => a.id === articleId);
        if (!art) return;

        articleToDelete = art;
        document.getElementById('delete-article-title').innerText = art.title || 'Untitled';
        document.getElementById('delete-article-id').innerText = art.id;
        deleteModal.classList.remove('hidden');
    };

    const hideModal = () => {
        deleteModal.classList.add('hidden');
        articleToDelete = null;
    };

    closeModal.onclick = hideModal;
    btnCancelDelete.onclick = hideModal;
    window.onclick = (e) => {
        if (e.target === deleteModal) hideModal();
    };

    btnConfirmDelete.onclick = async () => {
        if (!articleToDelete) return;

        try {
            btnConfirmDelete.disabled = true;
            btnConfirmDelete.innerText = 'Deleting...';

            await GitHubAPI.safeDeleteFile(
                articleToDelete.filePath,
                `Admin: Deleted article "${articleToDelete.title}" (ID: ${articleToDelete.id})`
            );

            alert('Article deleted successfully.');
            hideModal();
            loadArticles();
        } catch (e) {
            alert('Failed to delete article: ' + e.message);
        } finally {
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.innerText = 'Delete Permanently';
        }
    };

    // Logout
    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('current_user');
        window.location.href = '../../index.html';
    };

    // Initial Load
    loadArticles();
});