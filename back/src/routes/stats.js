const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, error } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');

// 获取仪表盘统计数据
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const stats = {};

    // 商品总数
    const [productCount] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE status = 1'
    );
    stats.totalProducts = productCount[0].count;

    // 待审批数量
    const [pendingCount] = await pool.query(
      'SELECT COUNT(*) as count FROM stock_requests WHERE status = "pending"'
    );
    stats.pendingRequests = pendingCount[0].count;

    // 今日审批数量
    const [todayApproved] = await pool.query(
      'SELECT COUNT(*) as count FROM stock_requests WHERE status = "approved" AND DATE(approved_at) = CURDATE()'
    );
    stats.todayApproved = todayApproved[0].count;

    // 待发货数量（已审批的出库单，但没有发货信息或发货状态为pending）
    const [pendingShipping] = await pool.query(
      `SELECT COUNT(*) as count FROM stock_requests sr
       LEFT JOIN shipping_info si ON sr.id = si.request_id
       WHERE sr.status = 'approved' AND sr.type = 'out'
       AND (si.id IS NULL OR si.shipping_status = 'pending')`
    );
    stats.pendingShipping = pendingShipping[0].count;

    success(res, stats);

  } catch (err) {
    console.error('获取统计数据错误:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;

