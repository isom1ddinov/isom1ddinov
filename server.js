const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const db = new Database('comments.db');
const JWT_SECRET = 'super_secret_key_123!';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ma'lumotlar bazasi
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    user_role TEXT,
    text TEXT,
    parent_id INTEGER DEFAULT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id INTEGER,
    user_id INTEGER,
    username TEXT,
    user_role TEXT,
    PRIMARY KEY (comment_id, user_id)
  );
`);

// Ustunlarni tekshirish
try {
    db.exec(`ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL;`);
} catch (e) {}
try {
    db.exec(`ALTER TABLE comments ADD COLUMN is_pinned INTEGER DEFAULT 0;`);
} catch (e) {}

// Founder (isom1ddinov) hisobini yaratish yoki yangilash
const founderUser = db.prepare('SELECT * FROM users WHERE username = ?').get('isom1ddinov');
if (!founderUser) {
    const hash = bcrypt.hashSync('admin20072007', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('isom1ddinov', hash, 'founder');
    console.log('Founder yaratildi: isom1ddinov');
} else {
    db.prepare('UPDATE users SET role = ? WHERE username = ?').run('founder', 'isom1ddinov');
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({
        message: "Avtorizatsiyadan o'ting"
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            message: "Noto'g'ri token"
        });
        req.user = user;
        next();
    });
}

// Auth APIs
app.post('/api/register', (req, res) => {
    const {
        username,
        password
    } = req.body;
    if (!username || !password) return res.status(400).json({
        message: "Barcha maydonlarni to'ldiring"
    });

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
        const result = stmt.run(username, hashedPassword);
        const token = jwt.sign({
            id: result.lastInsertRowid,
            username,
            role: 'user'
        }, JWT_SECRET);
        res.json({
            token,
            username,
            role: 'user'
        });
    } catch (err) {
        res.status(400).json({
            message: 'Bu user mavjud'
        });
    }
});

app.post('/api/login', (req, res) => {
    const {
        username,
        password
    } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(400).json({
            message: "Login yoki parol noto'g'ri"
        });
    }
    const token = jwt.sign({
        id: user.id,
        username: user.username,
        role: user.role
    }, JWT_SECRET);
    res.json({
        token,
        username: user.username,
        role: user.role
    });
});

// Get Comments
app.get('/api/comments', (req, res) => {
    const allComments = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count,
           (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND (user_role = 'founder' OR username = 'isom1ddinov')) as liked_by_founder
    FROM comments c
    ORDER BY c.created_at ASC
  `).all();

    const mainComments = [];
    const repliesMap = {};

    allComments.forEach(c => {
        if (c.parent_id) {
            if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
            repliesMap[c.parent_id].push(c);
        } else {
            mainComments.push(c);
        }
    });

    mainComments.sort((a, b) => b.is_pinned - a.is_pinned || b.id - a.id);
    res.json({
        mainComments,
        repliesMap
    });
});

// Post Comment
app.post('/api/comments', authenticateToken, (req, res) => {
    const {
        text,
        parent_id
    } = req.body;
    if (!text) return res.status(400).json({
        message: 'Izoh matnini kiriting'
    });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    const currentRole = user ? user.role : req.user.role;

    const stmt = db.prepare('INSERT INTO comments (user_id, username, user_role, text, parent_id) VALUES (?, ?, ?, ?, ?)');
    stmt.run(req.user.id, req.user.username, currentRole, text, parent_id || null);

    res.json({
        message: 'Izoh saqlandi'
    });
});

// Like API
app.post('/api/comments/like/:id', authenticateToken, (req, res) => {
    const {
        id
    } = req.params;
    const userId = req.user.id;
    const user = db.prepare('SELECT role, username FROM users WHERE id = ?').get(userId);
    const existingLike = db.prepare('SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?').get(id, userId);

    if (existingLike) {
        db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').run(id, userId);
    } else {
        db.prepare('INSERT INTO comment_likes (comment_id, user_id, username, user_role) VALUES (?, ?, ?, ?)').run(id, userId, user.username, user.role);
    }
    res.json({
        message: "OK"
    });
});

// Delete API
app.delete('/api/comments/:id', authenticateToken, (req, res) => {
    const {
        id
    } = req.params;
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) return res.status(404).json({
        message: "Topilmadi"
    });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    const role = user ? user.role : req.user.role;

    if (role === 'founder' || role === 'admin' || req.user.id === comment.user_id) {
        db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(id, id);
        db.prepare('DELETE FROM comment_likes WHERE comment_id = ?').run(id);
        return res.json({
            message: "O'chirildi"
        });
    }
    res.status(403).json({
        message: "Ruxsat yo'q"
    });
});

// Pin API
app.post('/api/comments/pin/:id', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    const role = user ? user.role : req.user.role;

    if (role !== 'founder' && role !== 'admin') {
        return res.status(403).json({
            message: "Ruxsat yo'q"
        });
    }

    const comment = db.prepare('SELECT is_pinned FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return res.status(404).json({
        message: "Topilmadi"
    });

    const newStatus = comment.is_pinned ? 0 : 1;
    db.prepare('UPDATE comments SET is_pinned = ? WHERE id = ?').run(newStatus, req.params.id);
    res.json({
        message: "OK"
    });
});

// Make Admin API
app.post('/api/users/make-admin', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    const role = user ? user.role : req.user.role;

    if (role !== 'founder') {
        return res.status(403).json({
            message: "Faqat Founder boshqalarga admin bera oladi"
        });
    }

    const {
        targetUsername
    } = req.body;
    const targetUser = db.prepare('SELECT * FROM users WHERE username = ?').get(targetUsername);

    if (!targetUser) return res.status(404).json({
        message: "Foydalanuvchi topilmadi"
    });

    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    db.prepare('UPDATE users SET role = ? WHERE username = ?').run(newRole, targetUsername);
    db.prepare('UPDATE comments SET user_role = ? WHERE username = ?').run(newRole, targetUsername);

    res.json({
        message: `${targetUsername} endi ${newRole === 'admin' ? 'Admin' : 'User'}`
    });
});

app.listen(3000, () => console.log('Server 3000-portda ishga tushdi: http://localhost:3000'));