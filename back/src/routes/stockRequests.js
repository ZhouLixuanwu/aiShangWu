const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, error, paginate, created } = require('../utils/response');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// 生成申请单号
const generateRequestNo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SR${year}${month}${day}${random}`;
};

// 获取库存变动申请列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, type, startDate, endDate, keyword, my } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT sr.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit,
             si.shipping_status, si.tracking_no
      FROM stock_requests sr
      LEFT JOIN products p ON sr.product_id = p.id
      LEFT JOIN shipping_info si ON sr.id = si.request_id
      WHERE 1=1
    `;
    let countSql = `
      SELECT COUNT(*) as total 
      FROM stock_requests sr
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    // 如果是查看自己的记录
    if (my === '1') {
      sql += ' AND sr.submitter_id = ?';
      countSql += ' AND sr.submitter_id = ?';
      params.push(req.user.id);
      countParams.push(req.user.id);
    } else if (!req.user.permissions.includes('stock_view_all')) {
      // 没有查看所有记录的权限，只能看自己的
      sql += ' AND sr.submitter_id = ?';
      countSql += ' AND sr.submitter_id = ?';
      params.push(req.user.id);
      countParams.push(req.user.id);
    }

    if (status) {
      sql += ' AND sr.status = ?';
      countSql += ' AND sr.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (type) {
      sql += ' AND sr.type = ?';
      countSql += ' AND sr.type = ?';
      params.push(type);
      countParams.push(type);
    }

    if (startDate) {
      sql += ' AND DATE(sr.created_at) >= ?';
      countSql += ' AND DATE(sr.created_at) >= ?';
      params.push(startDate);
      countParams.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(sr.created_at) <= ?';
      countSql += ' AND DATE(sr.created_at) <= ?';
      params.push(endDate);
      countParams.push(endDate);
    }

    if (keyword) {
      sql += ' AND (sr.request_no LIKE ? OR p.name LIKE ? OR sr.merchant LIKE ?)';
      countSql += ' AND (sr.request_no LIKE ? OR p.name LIKE ? OR sr.merchant LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY sr.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [requests] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    paginate(res, requests, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取库存变动申请列表错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取待审批的申请
router.get('/pending', authenticateToken, checkPermission('stock_approve'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT sr.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit, p.stock as current_stock
      FROM stock_requests sr
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE sr.status = 'pending'
      ORDER BY sr.id DESC
      LIMIT ? OFFSET ?
    `;

    const [requests] = await pool.query(sql, [parseInt(pageSize), offset]);
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM stock_requests WHERE status = "pending"'
    );

    paginate(res, requests, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取待审批申请错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取已审批记录（用于发货管理）
router.get('/approved', authenticateToken, checkPermission('shipping_manage', 'stock_view_all'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, shippingStatus, keyword } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT sr.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit,
             si.id as shipping_id, si.shipping_status, si.tracking_no, si.courier_company,
             si.shipping_address, si.receiver_name, si.receiver_phone, si.shipped_at, si.remark as shipping_remark
      FROM stock_requests sr
      LEFT JOIN products p ON sr.product_id = p.id
      LEFT JOIN shipping_info si ON sr.id = si.request_id
      WHERE sr.status = 'approved' AND sr.type = 'out'
    `;
    let countSql = `
      SELECT COUNT(*) as total
      FROM stock_requests sr
      LEFT JOIN shipping_info si ON sr.id = si.request_id
      WHERE sr.status = 'approved' AND sr.type = 'out'
    `;
    const params = [];
    const countParams = [];

    if (shippingStatus) {
      if (shippingStatus === 'none') {
        sql += ' AND si.id IS NULL';
        countSql += ' AND si.id IS NULL';
      } else {
        sql += ' AND si.shipping_status = ?';
        countSql += ' AND si.shipping_status = ?';
        params.push(shippingStatus);
        countParams.push(shippingStatus);
      }
    }

    if (keyword) {
      sql += ' AND (sr.request_no LIKE ? OR p.name LIKE ? OR sr.merchant LIKE ?)';
      countSql += ' AND (sr.request_no LIKE ? OR p.name LIKE ? OR sr.merchant LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY sr.approved_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [requests] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    paginate(res, requests, countResult[0].total, page, pageSize);

  } catch (err) {
    console.error('获取已审批记录错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 获取单个申请详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT sr.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit, p.stock as current_stock,
              si.id as shipping_id, si.shipping_status, si.tracking_no, si.courier_company,
              si.shipping_address, si.receiver_name, si.receiver_phone, si.shipped_at, si.remark as shipping_remark
       FROM stock_requests sr
       LEFT JOIN products p ON sr.product_id = p.id
       LEFT JOIN shipping_info si ON sr.id = si.request_id
       WHERE sr.id = ?`,
      [req.params.id]
    );

    if (requests.length === 0) {
      return error(res, '申请不存在', 404);
    }

    success(res, requests[0]);

  } catch (err) {
    console.error('获取申请详情错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 提交库存变动（无需审核，直接生效）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity, type, merchant, address, receiverName, receiverPhone, shippingFee, remark, salesmanId } = req.body;

    if (!productId || !quantity || !type) {
      return error(res, '商品、数量和类型不能为空', 400);
    }

    // 根据操作类型检查权限
    const requiredPermission = type === 'in' ? 'stock_add' : 'stock_reduce';
    if (!req.user.permissions.includes(requiredPermission)) {
      return error(res, type === 'in' ? '您没有入库权限' : '您没有出库权限', 403);
    }

    // 检查商品是否存在
    const [products] = await pool.query(
      'SELECT id, stock FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      return error(res, '商品不存在', 404);
    }

    const currentStock = products[0].stock;

    // 检查出库数量是否超过库存
    if (type === 'out' && quantity > currentStock) {
      return error(res, '出库数量不能超过当前库存', 400);
    }

    // 计算新库存
    const newStock = type === 'in' ? currentStock + quantity : currentStock - quantity;

    // 如果指定了业务员，获取业务员姓名
    let salesmanName = null;
    if (salesmanId) {
      const [salesmanResult] = await pool.query(
        'SELECT real_name FROM users WHERE id = ?',
        [salesmanId]
      );
      if (salesmanResult.length > 0) {
        salesmanName = salesmanResult[0].real_name;
      }
    }

    const requestNo = generateRequestNo();

    // 开启事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 插入记录（状态直接为approved，无需审核）
      const [result] = await connection.query(
        `INSERT INTO stock_requests 
         (request_no, product_id, quantity, type, merchant, address, receiver_name, receiver_phone, shipping_fee, remark, 
          status, submitter_id, submitter_name, salesman_id, salesman_name, approver_id, approver_name, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, NOW())`,
        [requestNo, productId, quantity, type, merchant, address, receiverName, receiverPhone, shippingFee || 'receiver', remark, 
         req.user.id, req.user.realName, salesmanId || null, salesmanName, req.user.id, req.user.realName]
      );

      // 直接更新库存
      await connection.query(
        'UPDATE products SET stock = ? WHERE id = ?',
        [newStock, productId]
      );

      await connection.commit();
      connection.release();

      created(res, { id: result.insertId, requestNo, newStock }, '操作成功，库存已更新');
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (err) {
    console.error('提交库存变动错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 审批申请
router.post('/:id/approve', authenticateToken, checkPermission('stock_approve'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, rejectReason } = req.body;

    const [requests] = await pool.query(
      'SELECT * FROM stock_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return error(res, '申请不存在', 404);
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return error(res, '该申请已处理', 400);
    }

    if (approved) {
      // 获取商品当前库存
      const [products] = await pool.query(
        'SELECT stock FROM products WHERE id = ?',
        [request.product_id]
      );

      if (products.length === 0) {
        return error(res, '商品不存在', 404);
      }

      const currentStock = products[0].stock;
      let newStock;

      if (request.type === 'in') {
        newStock = currentStock + request.quantity;
      } else {
        newStock = currentStock - request.quantity;
        if (newStock < 0) {
          return error(res, '库存不足', 400);
        }
      }

      // 更新库存
      await pool.query(
        'UPDATE products SET stock = ? WHERE id = ?',
        [newStock, request.product_id]
      );

      // 更新申请状态
      await pool.query(
        `UPDATE stock_requests SET 
         status = 'approved', approver_id = ?, approver_name = ?, approved_at = NOW()
         WHERE id = ?`,
        [req.user.id, req.user.realName, id]
      );

      success(res, { newStock }, '审批通过');
    } else {
      // 拒绝申请
      await pool.query(
        `UPDATE stock_requests SET 
         status = 'rejected', approver_id = ?, approver_name = ?, approved_at = NOW(), reject_reason = ?
         WHERE id = ?`,
        [req.user.id, req.user.realName, rejectReason, id]
      );

      success(res, null, '已拒绝申请');
    }

  } catch (err) {
    console.error('审批申请错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 更新发货信息
router.post('/:id/shipping', authenticateToken, checkPermission('shipping_manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { shippingStatus, trackingNo, courierCompany, shippingAddress, receiverName, receiverPhone, remark } = req.body;

    // 检查申请是否存在且已审批
    const [requests] = await pool.query(
      'SELECT * FROM stock_requests WHERE id = ? AND status = "approved"',
      [id]
    );

    if (requests.length === 0) {
      return error(res, '申请不存在或未审批', 404);
    }

    // 检查是否已有发货信息
    const [existing] = await pool.query(
      'SELECT id FROM shipping_info WHERE request_id = ?',
      [id]
    );

    if (existing.length > 0) {
      // 更新
      await pool.query(
        `UPDATE shipping_info SET 
         shipping_status = ?, tracking_no = ?, courier_company = ?, 
         shipping_address = ?, receiver_name = ?, receiver_phone = ?, remark = ?,
         shipped_at = ?, operator_id = ?
         WHERE request_id = ?`,
        [
          shippingStatus, trackingNo, courierCompany,
          shippingAddress, receiverName, receiverPhone, remark,
          shippingStatus === 'shipped' ? new Date() : null,
          req.user.id, id
        ]
      );
    } else {
      // 新建
      await pool.query(
        `INSERT INTO shipping_info 
         (request_id, shipping_status, tracking_no, courier_company, shipping_address, receiver_name, receiver_phone, remark, shipped_at, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, shippingStatus, trackingNo, courierCompany,
          shippingAddress, receiverName, receiverPhone, remark,
          shippingStatus === 'shipped' ? new Date() : null,
          req.user.id
        ]
      );
    }

    success(res, null, '发货信息更新成功');

  } catch (err) {
    console.error('更新发货信息错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

