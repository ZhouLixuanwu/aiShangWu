const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, error, paginate, created } = require('../utils/response');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// 获取商品列表
router.get('/', authenticateToken, checkPermission('inventory_view', 'inventory_manage'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, category, status } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT p.*, u.real_name as creator_name
      FROM products p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as total FROM products WHERE 1=1';
    const params = [];
    const countParams = [];

    if (keyword) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      countSql += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (category) {
      sql += ' AND p.category = ?';
      countSql += ' AND category = ?';
      params.push(category);
      countParams.push(category);
    }

    if (status !== undefined && status !== '') {
      sql += ' AND p.status = ?';
      countSql += ' AND status = ?';
      params.push(parseInt(status));
      countParams.push(parseInt(status));
    }

    sql += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [products] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    paginate(res, products, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取商品列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取所有商品（简化版，用于下拉选择）
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT id, name, sku, stock, unit FROM products WHERE status = 1 ORDER BY name'
    );
    success(res, products);
  } catch (err) {
    console.error('获取商品列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取商品分类
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" ORDER BY category'
    );
    success(res, categories.map(c => c.category));
  } catch (err) {
    console.error('获取分类错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取单个商品
router.get('/:id', authenticateToken, checkPermission('inventory_view', 'inventory_manage'), async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (products.length === 0) {
      return error(res, '商品不存在', 404);
    }

    success(res, products[0]);

  } catch (err) {
    console.error('获取商品错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 创建商品
router.post('/', authenticateToken, checkPermission('inventory_manage'), async (req, res) => {
  try {
    const { name, sku, category, unit, price, stock, minStock, description, image, status = 1 } = req.body;

    if (!name) {
      return error(res, '商品名称不能为空', 400);
    }

    // 检查SKU是否重复
    if (sku) {
      const [existing] = await pool.query(
        'SELECT id FROM products WHERE sku = ?',
        [sku]
      );
      if (existing.length > 0) {
        return error(res, '商品编码已存在', 400);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO products (name, sku, category, unit, price, stock, min_stock, description, image, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sku, category, unit || '个', price || 0, stock || 0, minStock || 0, description, image, status, req.user.id]
    );

    created(res, { id: result.insertId }, '商品创建成功');

  } catch (err) {
    console.error('创建商品错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新商品
router.put('/:id', authenticateToken, checkPermission('inventory_manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, category, unit, price, stock, minStock, description, image, status } = req.body;

    // 检查SKU是否重复
    if (sku) {
      const [existing] = await pool.query(
        'SELECT id FROM products WHERE sku = ? AND id != ?',
        [sku, id]
      );
      if (existing.length > 0) {
        return error(res, '商品编码已存在', 400);
      }
    }

    await pool.query(
      `UPDATE products SET 
        name = ?, sku = ?, category = ?, unit = ?, price = ?, 
        stock = ?, min_stock = ?, description = ?, image = ?, status = ?
       WHERE id = ?`,
      [name, sku, category, unit, price, stock, minStock, description, image, status, id]
    );

    success(res, null, '商品更新成功');

  } catch (err) {
    console.error('更新商品错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 删除商品
router.delete('/:id', authenticateToken, checkPermission('inventory_manage'), async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的库存变动记录
    const [requests] = await pool.query(
      'SELECT id FROM stock_requests WHERE product_id = ? LIMIT 1',
      [id]
    );

    if (requests.length > 0) {
      return error(res, '该商品有关联的库存变动记录，无法删除', 400);
    }

    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    success(res, null, '商品删除成功');

  } catch (err) {
    console.error('删除商品错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 批量更新库存
router.post('/batch-stock', authenticateToken, checkPermission('inventory_manage'), async (req, res) => {
  try {
    const { items } = req.body; // [{ id, stock }]

    if (!items || !Array.isArray(items)) {
      return error(res, '参数错误', 400);
    }

    for (const item of items) {
      await pool.query(
        'UPDATE products SET stock = ? WHERE id = ?',
        [item.stock, item.id]
      );
    }

    success(res, null, '库存更新成功');

  } catch (err) {
    console.error('批量更新库存错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

