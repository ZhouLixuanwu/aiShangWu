const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const { success, error, paginate, created } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { ossService } = require('../utils/oss');

// 配置multer用于处理文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// 每日达标任务量配置
const DAILY_TARGET = 5; // 每天需要上传5个素材

// 获取上传预签名URL（前端直传OSS）
router.post('/upload-url', authenticateToken, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    
    if (!filename || !contentType) {
      return error(res, '请提供文件名和类型', 400);
    }

    const key = ossService.generateKey(req.user.id, filename);
    const uploadUrl = await ossService.generateUploadUrl(key, contentType);

    success(res, {
      key,
      uploadUrl,
      publicUrl: ossService.getPublicUrl(key)
    });

  } catch (err) {
    console.error('生成上传URL错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 直接上传文件（后端接收文件再传OSS）
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请选择文件', 400);
    }

    const file = req.file;
    const key = ossService.generateKey(req.user.id, file.originalname);
    
    // 上传到OSS
    await ossService.uploadFile(key, file.buffer, {
      mime: file.mimetype
    });

    // 确定文件类型
    const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

    // 保存上传记录到数据库
    const [result] = await pool.query(
      `INSERT INTO media_uploads 
       (user_id, user_name, leader_id, oss_key, file_name, file_type, file_size, upload_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [req.user.id, req.user.realName, null, key, file.originalname, fileType, file.size]
    );

    // 获取用户的leader_id并更新
    const [userInfo] = await pool.query(
      'SELECT leader_id FROM users WHERE id = ?',
      [req.user.id]
    );
    if (userInfo.length > 0 && userInfo[0].leader_id) {
      await pool.query(
        'UPDATE media_uploads SET leader_id = ? WHERE id = ?',
        [userInfo[0].leader_id, result.insertId]
      );
    }

    const viewUrl = await ossService.generateViewUrl(key);

    created(res, {
      id: result.insertId,
      key,
      url: viewUrl,
      fileType
    }, '上传成功');

  } catch (err) {
    console.error('上传文件错误:', err);
    error(res, err.message || '服务器错误', 500);
  }
});

// 确认上传完成（前端直传后调用）
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { key, fileName, fileType, fileSize } = req.body;

    if (!key || !fileName) {
      return error(res, '请提供文件信息', 400);
    }

    // 获取用户的leader_id
    const [userInfo] = await pool.query(
      'SELECT leader_id FROM users WHERE id = ?',
      [req.user.id]
    );
    const leaderId = userInfo.length > 0 ? userInfo[0].leader_id : null;

    // 保存上传记录
    const [result] = await pool.query(
      `INSERT INTO media_uploads 
       (user_id, user_name, leader_id, oss_key, file_name, file_type, file_size, upload_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [req.user.id, req.user.realName, leaderId, key, fileName, fileType || 'image', fileSize || 0]
    );

    const viewUrl = await ossService.generateViewUrl(key);

    created(res, {
      id: result.insertId,
      url: viewUrl
    }, '上传成功');

  } catch (err) {
    console.error('确认上传错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取我的上传记录
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { date, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 获取指定日期的上传记录
    const [records] = await pool.query(
      `SELECT id, oss_key, file_name, file_type, file_size, created_at
       FROM media_uploads
       WHERE user_id = ? AND upload_date = ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, targetDate, parseInt(pageSize), offset]
    );

    // 获取总数
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM media_uploads WHERE user_id = ? AND upload_date = ?',
      [req.user.id, targetDate]
    );

    // 为每条记录生成访问URL
    const recordsWithUrl = await Promise.all(records.map(async (r) => ({
      ...r,
      url: await ossService.generateViewUrl(r.oss_key)
    })));

    // 获取今日统计
    const [todayStats] = await pool.query(
      'SELECT COUNT(*) as count FROM media_uploads WHERE user_id = ? AND upload_date = CURDATE()',
      [req.user.id]
    );

    success(res, {
      list: recordsWithUrl,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total
      },
      stats: {
        todayCount: todayStats[0].count,
        dailyTarget: DAILY_TARGET,
        completed: todayStats[0].count >= DAILY_TARGET
      }
    });

  } catch (err) {
    console.error('获取上传记录错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取我的上传统计（按日期）
router.get('/my-stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let sql = `
      SELECT upload_date, COUNT(*) as count
      FROM media_uploads
      WHERE user_id = ?
    `;
    const params = [req.user.id];

    if (startDate) {
      sql += ' AND upload_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND upload_date <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY upload_date ORDER BY upload_date DESC LIMIT 30';

    const [stats] = await pool.query(sql, params);

    // 今日统计
    const [todayStats] = await pool.query(
      'SELECT COUNT(*) as count FROM media_uploads WHERE user_id = ? AND upload_date = CURDATE()',
      [req.user.id]
    );

    success(res, {
      dailyStats: stats,
      today: {
        count: todayStats[0].count,
        target: DAILY_TARGET,
        completed: todayStats[0].count >= DAILY_TARGET
      }
    });

  } catch (err) {
    console.error('获取统计错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 组长：获取下属业务员的上传记录
router.get('/team', authenticateToken, async (req, res) => {
  try {
    const { date, salesmanId, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT m.id, m.user_id, m.user_name, m.oss_key, m.file_name, m.file_type, m.file_size, m.created_at
      FROM media_uploads m
      WHERE m.leader_id = ? AND m.upload_date = ?
    `;
    let countSql = `
      SELECT COUNT(*) as total FROM media_uploads m
      WHERE m.leader_id = ? AND m.upload_date = ?
    `;
    const params = [req.user.id, targetDate];
    const countParams = [req.user.id, targetDate];

    if (salesmanId) {
      sql += ' AND m.user_id = ?';
      countSql += ' AND m.user_id = ?';
      params.push(parseInt(salesmanId));
      countParams.push(parseInt(salesmanId));
    }

    sql += ' ORDER BY m.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [records] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    // 为每条记录生成访问URL
    const recordsWithUrl = await Promise.all(records.map(async (r) => ({
      ...r,
      url: await ossService.generateViewUrl(r.oss_key)
    })));

    success(res, {
      list: recordsWithUrl,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total
      }
    });

  } catch (err) {
    console.error('获取团队上传记录错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 组长：获取下属业务员的上传统计
router.get('/team-stats', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 获取每个业务员的上传统计
    const [stats] = await pool.query(
      `SELECT 
        u.id as user_id,
        u.real_name as user_name,
        u.username,
        COALESCE(m.count, 0) as upload_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM media_uploads
        WHERE leader_id = ? AND upload_date = ?
        GROUP BY user_id
      ) m ON u.id = m.user_id
      WHERE u.leader_id = ? AND u.status = 1
      ORDER BY upload_count DESC, u.id ASC`,
      [req.user.id, targetDate, req.user.id]
    );

    // 总计
    const [total] = await pool.query(
      'SELECT COUNT(*) as count FROM media_uploads WHERE leader_id = ? AND upload_date = ?',
      [req.user.id, targetDate]
    );

    success(res, {
      salesmen: stats.map(s => ({
        ...s,
        dailyTarget: DAILY_TARGET,
        completed: s.upload_count >= DAILY_TARGET
      })),
      total: {
        count: total[0].count,
        targetDate
      }
    });

  } catch (err) {
    console.error('获取团队统计错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除上传记录（只删除记录，OSS文件由生命周期规则自动删除）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否是自己的记录
    const [records] = await pool.query(
      'SELECT * FROM media_uploads WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '记录不存在', 404);
    }

    const record = records[0];
    
    // 只能删除自己的，或者组长可以删除下属的
    if (record.user_id !== req.user.id && record.leader_id !== req.user.id) {
      return error(res, '无权删除', 403);
    }

    // 尝试删除OSS文件（可选，因为有生命周期规则）
    await ossService.deleteFile(record.oss_key);

    // 删除数据库记录
    await pool.query('DELETE FROM media_uploads WHERE id = ?', [id]);

    success(res, null, '删除成功');

  } catch (err) {
    console.error('删除记录错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;
