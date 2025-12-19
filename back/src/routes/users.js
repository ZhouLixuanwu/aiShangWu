const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { success, error, paginate, created } = require('../utils/response');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// 获取用户列表
router.get('/', authenticateToken, checkPermission('user_view', 'user_manage'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT u.id, u.username, u.real_name, u.email, u.phone, u.status, u.created_at,
             u.user_type, u.leader_id, l.real_name as leader_name,
             GROUP_CONCAT(DISTINCT p.code) as permissions,
             GROUP_CONCAT(DISTINCT p.name) as permission_names
      FROM users u
      LEFT JOIN users l ON u.leader_id = l.id
      LEFT JOIN user_permissions up ON u.id = up.user_id
      LEFT JOIN permissions p ON up.permission_id = p.id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const params = [];
    const countParams = [];

    if (keyword) {
      sql += ' AND (u.username LIKE ? OR u.real_name LIKE ?)';
      countSql += ' AND (username LIKE ? OR real_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (status !== undefined && status !== '') {
      sql += ' AND u.status = ?';
      countSql += ' AND status = ?';
      params.push(parseInt(status));
      countParams.push(parseInt(status));
    }

    // 按用户类型和ID排序：管理员 > 组长 > 业务员，同类型按ID升序
    sql += ' GROUP BY u.id ORDER BY FIELD(u.user_type, "admin", "leader", "deliver", "editor", "salesman"), u.id ASC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [users] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    const userTypeMap = {
      'admin': '管理员',
      'leader': '商务/组长',
      'salesman': '业务员',
      'deliver': '发货员',
      'editor': '剪辑'
    };

    const formattedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      realName: u.real_name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      userType: u.user_type,
      userTypeName: userTypeMap[u.user_type] || '业务员',
      leaderId: u.leader_id,
      leaderName: u.leader_name,
      createdAt: u.created_at,
      permissions: u.permissions ? u.permissions.split(',') : [],
      permissionNames: u.permission_names ? u.permission_names.split(',') : []
    }));

    paginate(res, formattedUsers, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取用户列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取所有权限列表
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const [permissions] = await pool.query(
      'SELECT id, code, name, description, category FROM permissions ORDER BY category, id'
    );
    success(res, permissions);
  } catch (err) {
    console.error('获取权限列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 创建用户
router.post('/', authenticateToken, checkPermission('user_manage'), async (req, res) => {
  try {
    const { username, password, realName, email, phone, permissions = [] } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空', 400);
    }

    if (password.length < 6) {
      return error(res, '密码长度不能少于6位', 400);
    }

    // 检查用户名是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return error(res, '用户名已存在', 400);
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const [result] = await pool.query(
      'INSERT INTO users (username, password, real_name, email, phone) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, realName, email, phone]
    );

    const userId = result.insertId;

    // 分配权限
    if (permissions.length > 0) {
      const [permList] = await pool.query(
        'SELECT id FROM permissions WHERE code IN (?)',
        [permissions]
      );

      for (const perm of permList) {
        await pool.query(
          'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
          [userId, perm.id]
        );
      }
    }

    created(res, { id: userId }, '用户创建成功');

  } catch (err) {
    console.error('创建用户错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新用户
router.put('/:id', authenticateToken, checkPermission('user_manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { realName, email, phone, status, permissions } = req.body;

    // 更新用户基本信息
    await pool.query(
      'UPDATE users SET real_name = ?, email = ?, phone = ?, status = ? WHERE id = ?',
      [realName, email, phone, status, id]
    );

    // 更新权限
    if (permissions !== undefined) {
      // 删除旧权限
      await pool.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);

      // 添加新权限
      if (permissions.length > 0) {
        const [permList] = await pool.query(
          'SELECT id FROM permissions WHERE code IN (?)',
          [permissions]
        );

        for (const perm of permList) {
          await pool.query(
            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
            [id, perm.id]
          );
        }
      }
    }

    success(res, null, '用户更新成功');

  } catch (err) {
    console.error('更新用户错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 重置用户密码
router.put('/:id/password', authenticateToken, checkPermission('user_manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return error(res, '密码长度不能少于6位', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    success(res, null, '密码重置成功');

  } catch (err) {
    console.error('重置密码错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除用户
router.delete('/:id', authenticateToken, checkPermission('user_manage'), async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === 1) {
      return error(res, '不能删除管理员账号', 400);
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    success(res, null, '用户删除成功');

  } catch (err) {
    console.error('删除用户错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取当前用户下属的业务员列表
router.get('/my-salesmen', authenticateToken, async (req, res) => {
  try {
    // 查询当前用户下属的业务员（leader_id 等于当前用户ID的用户）
    const [salesmen] = await pool.query(
      `SELECT id, username, real_name, phone, status 
       FROM users 
       WHERE leader_id = ? AND status = 1
       ORDER BY id`,
      [req.user.id]
    );

    const formattedSalesmen = salesmen.map(s => ({
      id: s.id,
      username: s.username,
      realName: s.real_name,
      phone: s.phone
    }));

    success(res, formattedSalesmen);

  } catch (err) {
    console.error('获取下属业务员错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取所有业务员列表（自己名下的在前面）
router.get('/all-salesmen', authenticateToken, async (req, res) => {
  try {
    // 查询所有业务员，自己名下的排在前面
    const [salesmen] = await pool.query(
      `SELECT id, username, real_name, phone, leader_id,
              CASE WHEN leader_id = ? THEN 1 ELSE 0 END as is_mine
       FROM users 
       WHERE status = 1
       AND user_type = 'salesman'
       ORDER BY is_mine DESC, id`,
      [req.user.id]
    );

    const formattedSalesmen = salesmen.map(s => ({
      id: s.id,
      username: s.username,
      realName: s.real_name,
      phone: s.phone,
      isMine: s.leader_id === req.user.id
    }));

    success(res, formattedSalesmen);

  } catch (err) {
    console.error('获取所有业务员错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

