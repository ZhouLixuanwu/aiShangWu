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
      SELECT sr.*, si.shipping_status, si.tracking_no
      FROM stock_requests sr
      LEFT JOIN shipping_info si ON sr.id = si.request_id
      WHERE 1=1
    `;
    let countSql = `
      SELECT COUNT(*) as total 
      FROM stock_requests sr
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
      sql += ' AND (sr.request_no LIKE ? OR sr.items_summary LIKE ? OR sr.merchant LIKE ?)';
      countSql += ' AND (sr.request_no LIKE ? OR sr.items_summary LIKE ? OR sr.merchant LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY sr.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [requests] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    // 获取每个申请的商品明细
    for (let req of requests) {
      const [items] = await pool.query(
        'SELECT * FROM stock_request_items WHERE request_id = ?',
        [req.id]
      );
      req.items = items;
    }

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
      SELECT sr.*
      FROM stock_requests sr
      WHERE sr.status = 'pending'
      ORDER BY sr.id DESC
      LIMIT ? OFFSET ?
    `;

    const [requests] = await pool.query(sql, [parseInt(pageSize), offset]);
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM stock_requests WHERE status = "pending"'
    );

    // 获取每个申请的商品明细
    for (let req of requests) {
      const [items] = await pool.query(
        'SELECT * FROM stock_request_items WHERE request_id = ?',
        [req.id]
      );
      req.items = items;
    }

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

    // 出库和自购立牌都需要发货
    let sql = `
      SELECT sr.*,
             sr.receiver_name as orig_receiver_name, sr.receiver_phone as orig_receiver_phone, sr.address as orig_address,
             si.id as shipping_id, si.shipping_status, si.tracking_no, si.courier_company,
             si.shipping_address, si.receiver_name as si_receiver_name, si.receiver_phone as si_receiver_phone, 
             si.shipped_at, si.remark as shipping_remark
      FROM stock_requests sr
      LEFT JOIN shipping_info si ON sr.id = si.request_id
      WHERE sr.status = 'approved' AND sr.type IN ('out', 'self_purchase')
    `;
    let countSql = `
      SELECT COUNT(*) as total
      FROM stock_requests sr
      LEFT JOIN shipping_info si ON sr.id = si.request_id
      WHERE sr.status = 'approved' AND sr.type IN ('out', 'self_purchase')
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
      sql += ' AND (sr.request_no LIKE ? OR sr.items_summary LIKE ? OR sr.merchant LIKE ?)';
      countSql += ' AND (sr.request_no LIKE ? OR sr.items_summary LIKE ? OR sr.merchant LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY sr.approved_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [requests] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

    // 获取每个申请的商品明细
    for (let req of requests) {
      const [items] = await pool.query(
        'SELECT * FROM stock_request_items WHERE request_id = ?',
        [req.id]
      );
      req.items = items;
    }

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
      `SELECT sr.*,
              si.id as shipping_id, si.shipping_status, si.tracking_no, si.courier_company,
              si.shipping_address, si.receiver_name, si.receiver_phone, si.shipped_at, si.remark as shipping_remark
       FROM stock_requests sr
       LEFT JOIN shipping_info si ON sr.id = si.request_id
       WHERE sr.id = ?`,
      [req.params.id]
    );

    if (requests.length === 0) {
      return error(res, '申请不存在', 404);
    }

    // 获取商品明细
    const [items] = await pool.query(
      'SELECT * FROM stock_request_items WHERE request_id = ?',
      [req.params.id]
    );

    const result = requests[0];
    result.items = items;

    success(res, result);

  } catch (err) {
    console.error('获取申请详情错误:', err);
    error(res, '服务器错误', 500);
  }
});

// 提交库存变动申请（需要审批）- 支持多商品和自购立牌
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, type, merchant, address, receiverName, receiverPhone, shippingFee, remark, salesmanId, quantity } = req.body;
    
    // 自购立牌类型不需要商品
    if (type === 'self_purchase') {
      // 检查权限（复用出库权限）
      if (!req.user.permissions.includes('stock_reduce')) {
        return error(res, '您没有自购立牌权限', 403);
      }

      const selfPurchaseQuantity = quantity || 1;

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
      const itemsSummary = `自购立牌 x${selfPurchaseQuantity}`;

      // 插入主记录（状态为 pending 待审批）
      const [result] = await pool.query(
        `INSERT INTO stock_requests 
         (request_no, product_id, quantity, items_summary, type, merchant, address, receiver_name, receiver_phone, shipping_fee, remark, 
          status, submitter_id, submitter_name, salesman_id, salesman_name)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [requestNo, selfPurchaseQuantity, itemsSummary, type, merchant, address, receiverName, receiverPhone, shippingFee || 'receiver', remark, 
         req.user.id, req.user.realName, salesmanId || null, salesmanName]
      );

      return created(res, { id: result.insertId, requestNo, itemsSummary }, '自购立牌申请已提交，等待审批');
    }

    // 兼容旧接口：如果传的是单个 productId，转换为 items 数组
    let itemsList = items;
    if (!items && req.body.productId) {
      itemsList = [{ productId: req.body.productId, quantity: req.body.quantity }];
    }

    if (!itemsList || itemsList.length === 0 || !type) {
      return error(res, '商品和类型不能为空', 400);
    }

    // 根据操作类型检查权限
    const requiredPermission = type === 'in' ? 'stock_add' : 'stock_reduce';
    if (!req.user.permissions.includes(requiredPermission)) {
      return error(res, type === 'in' ? '您没有入库权限' : '您没有出库权限', 403);
    }

    // 检查所有商品是否存在，并验证库存
    const productIds = itemsList.map(item => item.productId);
    const [products] = await pool.query(
      'SELECT id, name, unit, stock FROM products WHERE id IN (?)',
      [productIds]
    );

    if (products.length !== productIds.length) {
      return error(res, '部分商品不存在', 404);
    }

    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // 出库时库存不足也允许提交申请，审批时会再次检查库存
    // 这里不再阻止提交，让用户可以先提交申请等待库存补足后审批
    // // 检查出库时库存是否足够（提交时预检查）
    // if (type === 'out') {
    //   for (const item of itemsList) {
    //     const product = productMap[item.productId];
    //     if (item.quantity > product.stock) {
    //       return error(res, `${product.name} 库存不足（当前: ${product.stock}，需要: ${item.quantity}）`, 400);
    //     }
    //   }
    // }

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

    // 生成商品摘要
    const itemsSummary = itemsList.map(item => {
      const product = productMap[item.productId];
      return `${product.name} x${item.quantity}`;
    }).join(', ');

    // 计算总数量
    const totalQuantity = itemsList.reduce((sum, item) => sum + item.quantity, 0);

    const requestNo = generateRequestNo();

    // 开启事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 插入主记录（状态为 pending 待审批）
      const firstItem = itemsList[0];
      const [result] = await connection.query(
        `INSERT INTO stock_requests 
         (request_no, product_id, quantity, items_summary, type, merchant, address, receiver_name, receiver_phone, shipping_fee, remark, 
          status, submitter_id, submitter_name, salesman_id, salesman_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [requestNo, firstItem.productId, totalQuantity, itemsSummary, type, merchant, address, receiverName, receiverPhone, shippingFee || 'receiver', remark, 
         req.user.id, req.user.realName, salesmanId || null, salesmanName]
      );

      const requestId = result.insertId;

      // 插入商品明细（不更新库存，等审批通过后再更新）
      for (const item of itemsList) {
        const product = productMap[item.productId];
        await connection.query(
          `INSERT INTO stock_request_items (request_id, product_id, product_name, product_unit, quantity)
           VALUES (?, ?, ?, ?, ?)`,
          [requestId, item.productId, product.name, product.unit, item.quantity]
        );
      }

      await connection.commit();
      connection.release();

      created(res, { id: requestId, requestNo, itemsSummary }, '申请已提交，等待审批');
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

// 审批申请（支持多商品和自购立牌）
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
      // 自购立牌不需要更新库存，直接审批通过
      if (request.type === 'self_purchase') {
        await pool.query(
          `UPDATE stock_requests SET 
           status = 'approved', approver_id = ?, approver_name = ?, approved_at = NOW()
           WHERE id = ?`,
          [req.user.id, req.user.realName, id]
        );
        return success(res, null, '审批通过，等待发货');
      }

      // 获取该申请的所有商品明细
      const [items] = await pool.query(
        'SELECT * FROM stock_request_items WHERE request_id = ?',
        [id]
      );

      if (items.length === 0) {
        return error(res, '该申请没有商品明细', 400);
      }

      // 获取所有相关商品的当前库存
      const productIds = items.map(item => item.product_id);
      const [products] = await pool.query(
        'SELECT id, stock FROM products WHERE id IN (?)',
        [productIds]
      );

      const productMap = {};
      products.forEach(p => { productMap[p.id] = p; });

      // 检查出库时库存是否足够
      if (request.type === 'out') {
        for (const item of items) {
          const product = productMap[item.product_id];
          if (!product) {
            return error(res, `商品 ${item.product_name} 不存在`, 404);
          }
          if (item.quantity > product.stock) {
            return error(res, `${item.product_name} 库存不足（当前: ${product.stock}，需要: ${item.quantity}）`, 400);
          }
        }
      }

      // 开启事务更新库存
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // 更新每个商品的库存
        for (const item of items) {
          const product = productMap[item.product_id];
          const newStock = request.type === 'in' 
            ? product.stock + item.quantity 
            : product.stock - item.quantity;
          
          await connection.query(
            'UPDATE products SET stock = ? WHERE id = ?',
            [newStock, item.product_id]
          );
        }

        // 更新申请状态
        await connection.query(
          `UPDATE stock_requests SET 
           status = 'approved', approver_id = ?, approver_name = ?, approved_at = NOW()
           WHERE id = ?`,
          [req.user.id, req.user.realName, id]
        );

        await connection.commit();
        connection.release();

        success(res, null, '审批通过，库存已更新');
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
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

// 更新申请的商品数量（审批前可以修改）
router.put('/:id/items', authenticateToken, checkPermission('stock_approve'), async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || items.length === 0) {
      return error(res, '请提供商品列表', 400);
    }

    // 检查申请是否存在且待审批
    const [requests] = await pool.query(
      'SELECT * FROM stock_requests WHERE id = ? AND status = "pending"',
      [id]
    );

    if (requests.length === 0) {
      return error(res, '申请不存在或已处理', 404);
    }

    // 开启事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 更新每个商品的数量
      for (const item of items) {
        if (item.quantity < 1) {
          throw new Error('数量必须大于0');
        }
        await connection.query(
          'UPDATE stock_request_items SET quantity = ? WHERE id = ? AND request_id = ?',
          [item.quantity, item.id, id]
        );
      }

      // 更新主表的 quantity 和 items_summary
      const [updatedItems] = await connection.query(
        'SELECT product_name, quantity FROM stock_request_items WHERE request_id = ?',
        [id]
      );

      const totalQuantity = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const itemsSummary = updatedItems.map(item => `${item.product_name} x${item.quantity}`).join(', ');

      await connection.query(
        'UPDATE stock_requests SET quantity = ?, items_summary = ? WHERE id = ?',
        [totalQuantity, itemsSummary, id]
      );

      await connection.commit();
      connection.release();

      success(res, null, '修改成功');
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (err) {
    console.error('更新申请商品数量错误:', err);
    error(res, err.message || '服务器错误', 500);
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

