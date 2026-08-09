let authMode = 'login';
let showAllComments = false;

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
    loadComments();
});

function toggleAuthTab(mode) {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('auth-submit-btn').textContent = mode === 'login' ? 'Kirish' : 'Ro\'yxatdan o\'tish';
}

async function handleAuth() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    if (!username || !password) return alert("Login va parolni kiriting!");

    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password
            })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message);

        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('role', data.role);

        checkAuthState();
        loadComments();
    } catch (err) {
        alert("Server bilan bog'lanishda xatolik");
    }
}

function checkAuthState() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

    const authBlock = document.getElementById('auth-block');
    const userBlock = document.getElementById('user-block');
    const commentFormBlock = document.getElementById('comment-form-block');

    if (token && authBlock) {
        authBlock.style.display = 'none';
        userBlock.style.display = 'block';
        commentFormBlock.style.display = 'block';
        document.getElementById('user-display-name').textContent = username;

        const badgeEl = document.getElementById('user-badge');
        if (role === 'founder' || username === 'isom1ddinov') badgeEl.innerHTML = `<span class="badge-founder">Founder</span>`;
        else if (role === 'admin') badgeEl.innerHTML = `<span class="badge-admin">Admin</span>`;
        else badgeEl.innerHTML = '';
    } else if (authBlock) {
        authBlock.style.display = 'block';
        userBlock.style.display = 'none';
        commentFormBlock.style.display = 'none';
    }
}

function logout() {
    localStorage.clear();
    checkAuthState();
    loadComments();
}

async function loadComments() {
    try {
        const res = await fetch('/api/comments');
        const {
            mainComments,
            repliesMap
        } = await res.json();
        const currentRole = localStorage.getItem('role');
        const currentUsername = localStorage.getItem('username');

        const listEl = document.getElementById('comments-list');
        const toggleContainer = document.getElementById('comments-toggle-container');
        if (!listEl) return;
        listEl.innerHTML = '';

        const visibleComments = showAllComments ? mainComments : mainComments.slice(0, 3);

        visibleComments.forEach(c => {
            const replies = repliesMap[c.id] || [];
            const item = renderCommentItem(c, replies, currentRole, currentUsername);
            listEl.appendChild(item);
        });

        if (toggleContainer) {
            if (mainComments.length > 3) {
                toggleContainer.style.display = 'block';
                toggleContainer.innerHTML = `
                    <button class="btn-toggle-comments" onclick="toggleCommentsView()">
                        ${showAllComments ? 'Izohlarni yashirish ▲' : `Barcha izohlarni ko'rish (${mainComments.length}) ▼`}
                    </button>
                `;
            } else {
                toggleContainer.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Yuklashda xatolik:', err);
    }
}

function renderCommentItem(c, replies, currentRole, currentUsername) {
    const isFounder = c.user_role === 'founder' || c.username === 'isom1ddinov';
    const isAdmin = c.user_role === 'admin';
    const isMyComment = currentUsername === c.username;

    const myRole = (currentUsername === 'isom1ddinov') ? 'founder' : currentRole;

    const canDelete = myRole === 'founder' || myRole === 'admin' || isMyComment;
    const canPin = (myRole === 'founder' || myRole === 'admin') && !c.parent_id;
    const canMakeAdmin = myRole === 'founder' && c.username !== 'isom1ddinov';

    const item = document.createElement('div');
    item.className = `comment-item ${c.is_pinned ? 'pinned-comment' : ''}`;

    let roleBadge = '';
    if (isFounder) roleBadge = '<span class="badge-founder">Founder</span>';
    else if (isAdmin) roleBadge = '<span class="badge-admin">Admin</span>';

    // SVG Ikonkalar
    const heartSvg = `<svg class="heardd" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    const replySvg = `<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>`;
    const pinSvg = `<svg class="pinn" viewBox="0 0 24 24"><path d="M16 9V4l1 0V2H7v2l1 0v5L6 11v2h5v7l1 1 1-1v-7h5v-2L16 9z"/></svg>`;

    item.innerHTML = `
        <div class="comment-header">
            <div class="gang">
                <span class="author-name ${isFounder ? 'founder-name' : ''}">${escapeHtml(c.username)}</span>
                ${roleBadge}
            </div>
            ${c.is_pinned ? `<span class="badge-pinned">${pinSvg} </span>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        
        <div class="comment-footer-info">
            <button class="btn-action-icon" onclick="likeComment(${c.id})">
                ${heartSvg} <span>${c.likes_count || 0}</span>
            </button>
            <button class="btn-action-icon" onclick="toggleReplyBox(${c.id})">
                ${replySvg} Javob berish
            </button>
            ${c.liked_by_founder > 0 ? `<span class="badge-founder-liked">${heartSvg} Liked by Founder</span>` : ''}
            <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
        </div>

        <div id="reply-box-${c.id}" class="reply-form-box" style="display: none;">
            <input type="text" id="reply-input-${c.id}" placeholder="${c.username} ga javob...">
            <button class="btn-send" onclick="postComment(${c.id})">Yuborish</button>
        </div>

        <div class="comment-actions">
            ${canPin ? `<button class="btn-admin-action" onclick="togglePinComment(${c.id})">${pinSvg} ${c.is_pinned ? 'Yechish' : 'Qadash'}</button>` : ''}
            ${canMakeAdmin ? `<button class="btn-admin-action" onclick="toggleAdminRole('${escapeHtml(c.username)}')">${isAdmin ? 'Adminlikni olish' : 'Admin qilish'}</button>` : ''}
            ${canDelete ? `<button class="btn-admin-action btn-delete-action" onclick="deleteComment(${c.id})">O'chirish</button>` : ''}
        </div>

        ${replies && replies.length > 0 ? `
            <button class="btn-view-replies" onclick="toggleReplies(${c.id})">
                ── Javoblarni ko'rish (${replies.length})
            </button>
            <div id="replies-${c.id}" class="replies-container">
                ${replies.map(r => `
                    <div class="comment-item" style="margin-bottom: 8px;">
                        <div class="comment-header">
                            <span class="author-name ${r.username === 'isom1ddinov' || r.user_role === 'founder' ? 'founder-name' : ''}">${escapeHtml(r.username)}</span>
                        </div>
                        <div class="comment-text">${escapeHtml(r.text)}</div>
                        <div class="comment-footer-info">
                            <button class="btn-action-icon" onclick="likeComment(${r.id})">${heartSvg} <span>${r.likes_count || 0}</span></button>
                            <span class="comment-date">${new Date(r.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;

    return item;
}

function toggleReplyBox(id) {
    const box = document.getElementById(`reply-box-${id}`);
    if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}

function toggleReplies(id) {
    const container = document.getElementById(`replies-${id}`);
    if (container) container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

async function postComment(parentId = null) {
    let text = '';
    if (parentId) {
        const input = document.getElementById(`reply-input-${parentId}`);
        text = input.value;
    } else {
        const input = document.getElementById('comment-text');
        text = input.value;
    }

    const token = localStorage.getItem('token');
    if (!token) return alert("Akkountingizga kiring!");
    if (!text.trim()) return;

    try {
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                text,
                parent_id: parentId
            })
        });

        if (res.ok) {
            showAllComments = true;
            loadComments();
        }
    } catch (err) {
        console.error(err);
    }
}

async function likeComment(id) {
    const token = localStorage.getItem('token');
    if (!token) return alert("Avvalo tizimga kiring!");
    await fetch(`/api/comments/like/${id}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    loadComments();
}

function toggleCommentsView() {
    showAllComments = !showAllComments;
    loadComments();
}

async function togglePinComment(id) {
    const token = localStorage.getItem('token');
    await fetch(`/api/comments/pin/${id}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    loadComments();
}

async function toggleAdminRole(targetUsername) {
    if (!confirm(`${targetUsername} holatini o'zgartirmoqchimisiz?`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/make-admin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            targetUsername
        })
    });
    const data = await res.json();
    alert(data.message);
    loadComments();
}

async function deleteComment(id) {
    if (!confirm('Izohni o\'chirasizmi?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    loadComments();
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        } [m];
    });
}