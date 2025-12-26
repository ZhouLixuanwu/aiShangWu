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
    fileSize: 10 * 1024 * 1024, // 10MB限制（身份证照片）
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式（JPG, PNG, GIF, WEBP）'), false);
    }
  }
});

// 生成商家信息文件的OSS key
const generateMerchantKey = (userId, filename) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now();
  const ext = filename.substring(filename.lastIndexOf('.'));
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  return `merchant/${userId}/${year}/${month}/${day}/${timestamp}-${randomStr}${ext}`;
};

// 上传商家信息（支持身份证正反面）
router.post('/register', authenticateToken, checkPermission('merchant_upload'), upload.fields([
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      phone, 
      businessScope, 
      businessName1, 
      businessName2, 
      businessName3,
      contactName,
      contactPhone 
    } = req.body;

    // 验证必填字段
    if (!phone || !businessScope || !businessName1 || !contactName || !contactPhone) {
      return error(res, '请填写所有必填信息', 400);
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone) || !/^1[3-9]\d{9}$/.test(contactPhone)) {
      return error(res, '请输入正确的手机号格式', 400);
    }

    // 处理身份证正面照片上传
    let idCardFrontKey = null;
    let idCardFrontUrl = null;
    
    if (req.files && req.files.idCardFront && req.files.idCardFront[0]) {
      const file = req.files.idCardFront[0];
      idCardFrontKey = generateMerchantKey(req.user.id, 'front_' + file.originalname);
      
      await ossService.uploadFile(idCardFrontKey, file.buffer, {
        mime: file.mimetype
      });
      
      idCardFrontUrl = await ossService.generateViewUrl(idCardFrontKey);
    }

    // 处理身份证反面照片上传
    let idCardBackKey = null;
    let idCardBackUrl = null;
    
    if (req.files && req.files.idCardBack && req.files.idCardBack[0]) {
      const file = req.files.idCardBack[0];
      idCardBackKey = generateMerchantKey(req.user.id, 'back_' + file.originalname);
      
      await ossService.uploadFile(idCardBackKey, file.buffer, {
        mime: file.mimetype
      });
      
      idCardBackUrl = await ossService.generateViewUrl(idCardBackKey);
    }

    // 保存到数据库
    const [result] = await pool.query(
      `INSERT INTO merchant_registrations 
       (user_id, user_name, phone, business_scope, business_name_1, business_name_2, business_name_3, 
        contact_name, contact_phone, id_card_front_key, id_card_back_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, 
        req.user.realName, 
        phone, 
        businessScope, 
        businessName1, 
        businessName2 || null, 
        businessName3 || null,
        contactName,
        contactPhone,
        idCardFrontKey,
        idCardBackKey
      ]
    );

    created(res, {
      id: result.insertId,
      idCardFrontUrl,
      idCardBackUrl
    }, '商家信息提交成功');

  } catch (err) {
    console.error('提交商家信息错误:', err);
    error(res, err.message || '服务器错误', 500);
  }
});

// 获取我的提交记录
router.get('/my', authenticateToken, checkPermission('merchant_upload'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const [records] = await pool.query(
      `SELECT id, phone, business_scope, business_name_1, business_name_2, business_name_3,
              contact_name, contact_phone, id_card_front_key, id_card_back_key, status, created_at, remark
       FROM merchant_registrations
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(pageSize), offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM merchant_registrations WHERE user_id = ?',
      [req.user.id]
    );

    // 为记录生成访问URL
    const recordsWithUrl = await Promise.all(records.map(async (r) => ({
      ...r,
      idCardFrontUrl: r.id_card_front_key ? await ossService.generateViewUrl(r.id_card_front_key) : null,
      idCardBackUrl: r.id_card_back_key ? await ossService.generateViewUrl(r.id_card_back_key) : null
    })));

    paginate(res, recordsWithUrl, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取我的商家信息错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取所有商家信息（需要权限）
router.get('/all', authenticateToken, checkPermission('merchant_view_all'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status, userId } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT m.id, m.user_id, m.user_name, m.phone, m.business_scope, 
             m.business_name_1, m.business_name_2, m.business_name_3,
             m.contact_name, m.contact_phone, m.id_card_front_key, m.id_card_back_key,
             m.status, m.created_at, m.remark
      FROM merchant_registrations m
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as total FROM merchant_registrations m WHERE 1=1';
    const params = [];
    const countParams = [];

    if (keyword) {
      sql += ' AND (m.phone LIKE ? OR m.business_name_1 LIKE ? OR m.contact_name LIKE ? OR m.user_name LIKE ?)';
      countSql += ' AND (m.phone LIKE ? OR m.business_name_1 LIKE ? OR m.contact_name LIKE ? OR m.user_name LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw, kw);
      countParams.push(kw, kw, kw, kw);
    }

    if (status !== undefined && status !== '') {
      sql += ' AND m.status = ?';
      countSql += ' AND m.status = ?';
      params.push(parseInt(status));
      countParams.push(parseInt(status));
    }

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

    // 为记录生成访问URL
    const recordsWithUrl = await Promise.all(records.map(async (r) => ({
      ...r,
      idCardFrontUrl: r.id_card_front_key ? await ossService.generateViewUrl(r.id_card_front_key) : null,
      idCardBackUrl: r.id_card_back_key ? await ossService.generateViewUrl(r.id_card_back_key) : null
    })));

    paginate(res, recordsWithUrl, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取所有商家信息错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新商家信息状态（审核）
router.put('/:id/status', authenticateToken, checkPermission('merchant_view_all'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;

    // 验证状态值
    if (![0, 1, 2].includes(status)) {
      return error(res, '无效的状态值', 400);
    }

    // 检查记录是否存在
    const [records] = await pool.query(
      'SELECT id FROM merchant_registrations WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '记录不存在', 404);
    }

    // 更新状态
    await pool.query(
      'UPDATE merchant_registrations SET status = ?, remark = ? WHERE id = ?',
      [status, remark || null, id]
    );

    success(res, null, '状态更新成功');

  } catch (err) {
    console.error('更新商家状态错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除商家信息
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查记录是否存在
    const [records] = await pool.query(
      'SELECT * FROM merchant_registrations WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '记录不存在', 404);
    }

    const record = records[0];
    
    // 只能删除自己的，或者有 merchant_view_all 权限
    const hasViewAll = req.user.permissions && req.user.permissions.includes('merchant_view_all');
    if (record.user_id !== req.user.id && !hasViewAll) {
      return error(res, '无权删除', 403);
    }

    // 删除OSS文件
    if (record.id_card_front_key) {
      await ossService.deleteFile(record.id_card_front_key);
    }
    if (record.id_card_back_key) {
      await ossService.deleteFile(record.id_card_back_key);
    }

    // 删除数据库记录
    await pool.query('DELETE FROM merchant_registrations WHERE id = ?', [id]);

    success(res, null, '删除成功');

  } catch (err) {
    console.error('删除商家信息错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取提交者列表（用于筛选）
router.get('/submitters', authenticateToken, checkPermission('merchant_view_all'), async (req, res) => {
  try {
    const [submitters] = await pool.query(
      `SELECT DISTINCT m.user_id, m.user_name
       FROM merchant_registrations m
       ORDER BY m.user_name`
    );

    success(res, submitters);

  } catch (err) {
    console.error('获取提交者列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

