const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { success, error } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空', 400);
    }

    // 查询用户
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return error(res, '用户名或密码错误', 401);
    }

    const user = users[0];

    if (user.status !== 1) {
      return error(res, '账号已被禁用', 403);
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return error(res, '用户名或密码错误', 401);
    }

    // 获取用户权限
    const [permissions] = await pool.query(
      `SELECT p.code, p.name 
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.id
       WHERE up.user_id = ?`,
      [user.id]
    );

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        permissions: permissions.map(p => p.code)
      }
    }, '登录成功');

  } catch (err) {
    console.error('登录错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.real_name, u.email, u.phone, u.avatar,
              GROUP_CONCAT(p.code) as permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       LEFT JOIN permissions p ON up.permission_id = p.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [req.user.id]
    );

    if (users.length === 0) {
      return error(res, '用户不存在', 404);
    }

    const user = users[0];
    success(res, {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      permissions: user.permissions ? user.permissions.split(',') : []
    });

  } catch (err) {
    console.error('获取用户信息错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 修改密码
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return error(res, '请填写旧密码和新密码', 400);
    }

    if (newPassword.length < 6) {
      return error(res, '新密码长度不能少于6位', 400);
    }

    const [users] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(oldPassword, users[0].password);
    if (!isMatch) {
      return error(res, '旧密码错误', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    success(res, null, '密码修改成功');

  } catch (err) {
    console.error('修改密码错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

