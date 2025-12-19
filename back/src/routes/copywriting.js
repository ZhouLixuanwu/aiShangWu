const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, error, created } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { ossService } = require('../utils/oss');

// =============================================
// 文案模版相关 API
// =============================================

// 获取所有文案模版
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    
    let sql = 'SELECT * FROM copywriting_templates WHERE 1=1';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY use_count DESC, id DESC';
    
    const [templates] = await pool.query(sql, params);
    success(res, templates);
  } catch (err) {
    console.error('获取文案模版失败:', err);
    error(res, '服务器错误', 500);
  }
});

// 创建文案模版
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const { title, category, content } = req.body;
    
    if (!title || !category || !content) {
      return error(res, '请填写完整信息', 400);
    }
    
    const [result] = await pool.query(
      `INSERT INTO copywriting_templates (title, category, content, created_by)
       VALUES (?, ?, ?, ?)`,
      [title, category, content, req.user.id]
    );
    
    created(res, { id: result.insertId }, '创建成功');
  } catch (err) {
    console.error('创建文案模版失败:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新文案模版
router.put('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, content } = req.body;
    
    if (!title || !category || !content) {
      return error(res, '请填写完整信息', 400);
    }
    
    await pool.query(
      `UPDATE copywriting_templates 
       SET title = ?, category = ?, content = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, category, content, id]
    );
    
    success(res, null, '更新成功');
  } catch (err) {
    console.error('更新文案模版失败:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除文案模版
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM copywriting_templates WHERE id = ?', [id]);
    
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除文案模版失败:', err);
    error(res, '服务器错误', 500);
  }
});

// =============================================
// 素材文案相关 API
// =============================================

// 获取素材列表（带文案状态）
router.get('/media-list', authenticateToken, async (req, res) => {
  try {
    const { date, salesmanId, copywritingFilter, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT m.id, m.user_id, m.user_name, m.oss_key, m.file_name, m.file_type, 
             m.file_size, m.created_at, m.copywriting, m.copywriting_updated_at
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

    // 文案筛选
    if (copywritingFilter === 'with') {
      sql += ' AND m.copywriting IS NOT NULL AND m.copywriting != ""';
      countSql += ' AND m.copywriting IS NOT NULL AND m.copywriting != ""';
    } else if (copywritingFilter === 'without') {
      sql += ' AND (m.copywriting IS NULL OR m.copywriting = "")';
      countSql += ' AND (m.copywriting IS NULL OR m.copywriting = "")';
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
    console.error('获取素材列表失败:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新素材文案
router.put('/media/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { copywriting, templateId } = req.body;

    // 检查权限：只有组长可以编辑
    const [records] = await pool.query(
      'SELECT * FROM media_uploads WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return error(res, '素材不存在', 404);
    }

    const record = records[0];
    
    // 检查是否是该素材的组长
    if (record.leader_id !== req.user.id) {
      return error(res, '无权编辑', 403);
    }

    // 更新文案
    await pool.query(
      `UPDATE media_uploads 
       SET copywriting = ?, copywriting_updated_at = NOW(), copywriting_updated_by = ?
       WHERE id = ?`,
      [copywriting, req.user.id, id]
    );

    // 如果使用了模版，增加使用次数
    if (templateId) {
      await pool.query(
        'UPDATE copywriting_templates SET use_count = use_count + 1 WHERE id = ?',
        [templateId]
      );
    }

    success(res, null, '保存成功');
  } catch (err) {
    console.error('更新素材文案失败:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;
