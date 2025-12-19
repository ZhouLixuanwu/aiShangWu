const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const { success, error, paginate, created } = require('../utils/response');
const { authenticateToken, checkPermission } = require('../middleware/auth');
const { ossService } = require('../utils/oss');

// 配置multer用于处理文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
      'video/3gpp', 'video/x-m4v', 'video/mpeg' // 添加更多视频格式
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// 每日达标任务量配置
const DAILY_TARGET = 2; // 每天需要上传2个素材

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
// source 参数: 'media'(默认) = 素材上传(计入统计), 'log' = 日志图片(不计入统计)
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请选择文件', 400);
    }

    const file = req.file;
    const source = req.body.source || 'media'; // 默认为素材上传
    
    // 处理中文文件名：优先使用前端传递的原始文件名，否则使用 multer 解析的文件名
    let originalName = req.body.originalName || file.originalname;
    
    // 尝试解码可能被编码的文件名
    try {
      // 如果文件名是 URL 编码的，解码它
      if (originalName && originalName.includes('%')) {
        originalName = decodeURIComponent(originalName);
      }
      // 如果文件名是 latin1 编码的中文（常见于 multipart），转换为 UTF-8
      if (originalName && /[\x80-\xff]/.test(originalName)) {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      }
    } catch (e) {
      // 解码失败则使用原值
      console.log('文件名解码失败，使用原值:', e.message);
    }
    
    const key = ossService.generateKey(req.user.id, originalName);
    
    // 上传到OSS
    await ossService.uploadFile(key, file.buffer, {
      mime: file.mimetype
    });

    // 确定文件类型
    const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

    const viewUrl = await ossService.generateViewUrl(key);

    // 只有素材上传才保存到数据库，日志图片不计入统计
    if (source === 'media') {
      const merchant = req.body.merchant || null; // 商家名称

      // 保存上传记录到数据库（使用处理后的中文文件名）
      const [result] = await pool.query(
        `INSERT INTO media_uploads 
         (user_id, user_name, leader_id, oss_key, file_name, file_type, file_size, upload_date, merchant)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
        [req.user.id, req.user.realName, null, key, originalName, fileType, file.size, merchant]
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

      created(res, {
        id: result.insertId,
        key,
        url: viewUrl,
        fileType,
        merchant
      }, '上传成功');
    } else {
      // 日志图片上传，只返回URL，不保存记录
      created(res, {
        key,
        url: viewUrl,
        fileType
      }, '上传成功');
    }

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
      `SELECT id, oss_key, file_name, file_type, file_size, created_at, merchant
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

// 更新素材的商家名称
router.put('/:id/merchant', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { merchant } = req.body;

    // 检查是否是自己的记录
    const [records] = await pool.query(
      'SELECT * FROM media_uploads WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '记录不存在', 404);
    }

    const record = records[0];
    
    // 只能修改自己的，或者组长可以修改下属的，或者有media_view_all权限
    const hasViewAll = req.user.permissions && req.user.permissions.includes('media_view_all');
    if (record.user_id !== req.user.id && record.leader_id !== req.user.id && !hasViewAll) {
      return error(res, '无权修改', 403);
    }

    // 更新商家名称
    await pool.query('UPDATE media_uploads SET merchant = ? WHERE id = ?', [merchant || null, id]);

    success(res, null, '更新成功');

  } catch (err) {
    console.error('更新商家名称错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 管理员：获取所有业务员的上传记录
router.get('/all', authenticateToken, checkPermission('media_view_all'), async (req, res) => {
  try {
    const { date, userId, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT m.id, m.user_id, m.user_name, m.oss_key, m.file_name, m.file_type, m.file_size, m.created_at, m.merchant
      FROM media_uploads m
      WHERE m.upload_date = ?
    `;
    let countSql = `
      SELECT COUNT(*) as total FROM media_uploads m
      WHERE m.upload_date = ?
    `;
    const params = [targetDate];
    const countParams = [targetDate];

    if (userId) {
      sql += ' AND m.user_id = ?';
      countSql += ' AND m.user_id = ?';
      params.push(parseInt(userId));
      countParams.push(parseInt(userId));
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
    console.error('获取所有上传记录错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 管理员：获取所有业务员的上传统计
router.get('/all-stats', authenticateToken, checkPermission('media_view_all'), async (req, res) => {
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
        WHERE upload_date = ?
        GROUP BY user_id
      ) m ON u.id = m.user_id
      WHERE u.status = 1
      ORDER BY upload_count DESC, u.id ASC`,
      [targetDate]
    );

    // 总计
    const [total] = await pool.query(
      'SELECT COUNT(*) as count FROM media_uploads WHERE upload_date = ?',
      [targetDate]
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
    console.error('获取所有业务员统计错误:', err);
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

// ==================== 分组管理 ====================

// 创建分组
router.post('/groups', authenticateToken, async (req, res) => {
  try {
    const { name, merchant } = req.body;
    
    if (!name) {
      return error(res, '请输入分组名称', 400);
    }

    // 获取用户的leader_id
    const [userInfo] = await pool.query(
      'SELECT leader_id FROM users WHERE id = ?',
      [req.user.id]
    );
    const leaderId = userInfo.length > 0 ? userInfo[0].leader_id : null;

    const [result] = await pool.query(
      `INSERT INTO media_groups (name, user_id, user_name, leader_id, merchant, upload_date)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [name, req.user.id, req.user.realName, leaderId, merchant || null]
    );

    created(res, { id: result.insertId, name, merchant }, '分组创建成功');

  } catch (err) {
    console.error('创建分组错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取我的分组列表
router.get('/groups/my', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [groups] = await pool.query(
      `SELECT g.*, 
        (SELECT COUNT(*) FROM media_uploads WHERE group_id = g.id) as media_count
       FROM media_groups g
       WHERE g.user_id = ? AND g.upload_date = ?
       ORDER BY g.id DESC`,
      [req.user.id, targetDate]
    );

    success(res, groups);

  } catch (err) {
    console.error('获取分组列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取所有分组（管理员）
router.get('/groups/all', authenticateToken, checkPermission('media_view_all'), async (req, res) => {
  try {
    const { date, userId } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT g.*, 
        (SELECT COUNT(*) FROM media_uploads WHERE group_id = g.id) as media_count
       FROM media_groups g
       WHERE g.upload_date = ?
    `;
    const params = [targetDate];

    if (userId) {
      sql += ' AND g.user_id = ?';
      params.push(parseInt(userId));
    }

    sql += ' ORDER BY g.id DESC';

    const [groups] = await pool.query(sql, params);

    success(res, groups);

  } catch (err) {
    console.error('获取所有分组错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取分组内的素材
router.get('/groups/:id/media', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查分组是否存在
    const [groups] = await pool.query(
      'SELECT * FROM media_groups WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return error(res, '分组不存在', 404);
    }

    const group = groups[0];
    
    // 权限检查
    const hasViewAll = req.user.permissions && req.user.permissions.includes('media_view_all');
    if (group.user_id !== req.user.id && group.leader_id !== req.user.id && !hasViewAll) {
      return error(res, '无权查看', 403);
    }

    // 获取分组内的素材
    const [records] = await pool.query(
      `SELECT id, oss_key, file_name, file_type, file_size, created_at, merchant
       FROM media_uploads WHERE group_id = ? ORDER BY id ASC`,
      [id]
    );

    // 为每条记录生成访问URL
    const recordsWithUrl = await Promise.all(records.map(async (r) => ({
      ...r,
      url: await ossService.generateViewUrl(r.oss_key)
    })));

    success(res, {
      group,
      media: recordsWithUrl
    });

  } catch (err) {
    console.error('获取分组素材错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新分组信息（名称、商家）
router.put('/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, merchant } = req.body;

    // 检查分组是否存在
    const [groups] = await pool.query(
      'SELECT * FROM media_groups WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return error(res, '分组不存在', 404);
    }

    const group = groups[0];
    
    // 权限检查
    const hasViewAll = req.user.permissions && req.user.permissions.includes('media_view_all');
    if (group.user_id !== req.user.id && group.leader_id !== req.user.id && !hasViewAll) {
      return error(res, '无权修改', 403);
    }

    // 更新分组
    await pool.query(
      'UPDATE media_groups SET name = ?, merchant = ? WHERE id = ?',
      [name || group.name, merchant !== undefined ? merchant : group.merchant, id]
    );

    success(res, null, '更新成功');

  } catch (err) {
    console.error('更新分组错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除分组（分组内的素材会被设为无分组）
router.delete('/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查分组是否存在
    const [groups] = await pool.query(
      'SELECT * FROM media_groups WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return error(res, '分组不存在', 404);
    }

    const group = groups[0];
    
    // 权限检查
    const hasViewAll = req.user.permissions && req.user.permissions.includes('media_view_all');
    if (group.user_id !== req.user.id && group.leader_id !== req.user.id && !hasViewAll) {
      return error(res, '无权删除', 403);
    }

    // 删除分组（外键设置了 ON DELETE SET NULL，素材的 group_id 会自动置空）
    await pool.query('DELETE FROM media_groups WHERE id = ?', [id]);

    success(res, null, '删除成功');

  } catch (err) {
    console.error('删除分组错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 将素材加入分组
router.put('/:id/group', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { groupId } = req.body;

    // 检查素材是否存在
    const [records] = await pool.query(
      'SELECT * FROM media_uploads WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '素材不存在', 404);
    }

    const record = records[0];
    
    // 权限检查
    const hasViewAll = req.user.permissions && req.user.permissions.includes('media_view_all');
    if (record.user_id !== req.user.id && record.leader_id !== req.user.id && !hasViewAll) {
      return error(res, '无权修改', 403);
    }

    // 如果指定了分组，检查分组是否存在且有权限
    if (groupId) {
      const [groups] = await pool.query(
        'SELECT * FROM media_groups WHERE id = ?',
        [groupId]
      );
      if (groups.length === 0) {
        return error(res, '分组不存在', 404);
      }
      // 只能加入自己的分组
      if (groups[0].user_id !== req.user.id && !hasViewAll) {
        return error(res, '无权将素材加入此分组', 403);
      }
    }

    // 更新素材的分组
    await pool.query('UPDATE media_uploads SET group_id = ? WHERE id = ?', [groupId || null, id]);

    success(res, null, groupId ? '已加入分组' : '已移出分组');

  } catch (err) {
    console.error('更新素材分组错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 素材重命名
router.put('/:id/rename', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName } = req.body;

    if (!fileName) {
      return error(res, '请输入文件名', 400);
    }

    // 检查素材是否存在
    const [records] = await pool.query(
      'SELECT * FROM media_uploads WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '素材不存在', 404);
    }

    const record = records[0];
    
    // 权限检查
    const hasViewAll = req.user.permissions && req.user.permissions.includes('media_view_all');
    if (record.user_id !== req.user.id && record.leader_id !== req.user.id && !hasViewAll) {
      return error(res, '无权修改', 403);
    }

    // 更新文件名
    await pool.query('UPDATE media_uploads SET file_name = ? WHERE id = ?', [fileName, id]);

    success(res, null, '重命名成功');

  } catch (err) {
    console.error('重命名错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;
