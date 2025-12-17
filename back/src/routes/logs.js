const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, error, paginate, created } = require('../utils/response');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// 获取日志列表
router.get('/', authenticateToken, checkPermission('log_write', 'log_view_all'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, userId, startDate, endDate } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT dl.*, u.username, u.real_name
      FROM daily_logs dl
      LEFT JOIN users u ON dl.user_id = u.id
      WHERE 1=1
    `;
    let countSql = `
      SELECT COUNT(*) as total
      FROM daily_logs dl
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    // 如果没有查看所有日志的权限，只能看自己的
    if (!req.user.permissions.includes('log_view_all')) {
      sql += ' AND dl.user_id = ?';
      countSql += ' AND dl.user_id = ?';
      params.push(req.user.id);
      countParams.push(req.user.id);
    } else if (userId) {
      sql += ' AND dl.user_id = ?';
      countSql += ' AND dl.user_id = ?';
      params.push(parseInt(userId));
      countParams.push(parseInt(userId));
    }

    if (startDate) {
      sql += ' AND dl.log_date >= ?';
      countSql += ' AND dl.log_date >= ?';
      params.push(startDate);
      countParams.push(startDate);
    }

    if (endDate) {
      sql += ' AND dl.log_date <= ?';
      countSql += ' AND dl.log_date <= ?';
      params.push(endDate);
      countParams.push(endDate);
    }

    sql += ' ORDER BY dl.log_date DESC, dl.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [logs] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    paginate(res, logs, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取日志列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取今日日志
router.get('/today', authenticateToken, checkPermission('log_write'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [logs] = await pool.query(
      'SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?',
      [req.user.id, today]
    );

    if (logs.length === 0) {
      return success(res, null);
    }

    success(res, logs[0]);

  } catch (err) {
    console.error('获取今日日志错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取单个日志
router.get('/:id', authenticateToken, checkPermission('log_write', 'log_view_all'), async (req, res) => {
  try {
    let sql = 'SELECT dl.*, u.username, u.real_name FROM daily_logs dl LEFT JOIN users u ON dl.user_id = u.id WHERE dl.id = ?';
    const params = [req.params.id];

    // 如果没有查看所有日志的权限，只能看自己的
    if (!req.user.permissions.includes('log_view_all')) {
      sql += ' AND dl.user_id = ?';
      params.push(req.user.id);
    }

    const [logs] = await pool.query(sql, params);

    if (logs.length === 0) {
      return error(res, '日志不存在', 404);
    }

    success(res, logs[0]);

  } catch (err) {
    console.error('获取日志错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 写日志
router.post('/', authenticateToken, checkPermission('log_write'), async (req, res) => {
  try {
    const { logDate, content, workHours } = req.body;

    if (!logDate || !content) {
      return error(res, '日期和内容不能为空', 400);
    }

    // 检查是否已存在该日期的日志
    const [existing] = await pool.query(
      'SELECT id FROM daily_logs WHERE user_id = ? AND log_date = ?',
      [req.user.id, logDate]
    );

    if (existing.length > 0) {
      // 更新
      await pool.query(
        'UPDATE daily_logs SET content = ?, work_hours = ? WHERE user_id = ? AND log_date = ?',
        [content, workHours || 8, req.user.id, logDate]
      );
      success(res, { id: existing[0].id }, '日志更新成功');
    } else {
      // 新建
      const [result] = await pool.query(
        'INSERT INTO daily_logs (user_id, log_date, content, work_hours) VALUES (?, ?, ?, ?)',
        [req.user.id, logDate, content, workHours || 8]
      );
      created(res, { id: result.insertId }, '日志创建成功');
    }

  } catch (err) {
    console.error('写日志错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新日志
router.put('/:id', authenticateToken, checkPermission('log_write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { content, workHours } = req.body;

    // 检查日志是否存在且属于当前用户
    const [logs] = await pool.query(
      'SELECT * FROM daily_logs WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (logs.length === 0) {
      return error(res, '日志不存在或无权修改', 404);
    }

    await pool.query(
      'UPDATE daily_logs SET content = ?, work_hours = ? WHERE id = ?',
      [content, workHours, id]
    );

    success(res, null, '日志更新成功');

  } catch (err) {
    console.error('更新日志错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除日志
router.delete('/:id', authenticateToken, checkPermission('log_write'), async (req, res) => {
  try {
    const { id } = req.params;

    // 检查日志是否存在且属于当前用户
    const [logs] = await pool.query(
      'SELECT * FROM daily_logs WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (logs.length === 0) {
      return error(res, '日志不存在或无权删除', 404);
    }

    await pool.query('DELETE FROM daily_logs WHERE id = ?', [id]);
    success(res, null, '日志删除成功');

  } catch (err) {
    console.error('删除日志错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取团队成员列表（用于查看日志时选择用户）
router.get('/users/list', authenticateToken, checkPermission('log_view_all'), async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, real_name FROM users WHERE status = 1 ORDER BY id'
    );
    success(res, users);
  } catch (err) {
    console.error('获取用户列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

