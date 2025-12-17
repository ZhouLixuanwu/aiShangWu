const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// 验证JWT Token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 获取用户信息和权限
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.real_name, u.status,
              GROUP_CONCAT(p.code) as permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       LEFT JOIN permissions p ON up.permission_id = p.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [decoded.userId]
    );

    if (users.length === 0 || users[0].status !== 1) {
      return res.status(401).json({ code: 401, message: '用户不存在或已被禁用' });
    }

    req.user = {
      id: users[0].id,
      username: users[0].username,
      realName: users[0].real_name,
      permissions: users[0].permissions ? users[0].permissions.split(',') : []
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, message: '令牌已过期' });
    }
    return res.status(403).json({ code: 403, message: '无效的令牌' });
  }
};

// 检查权限
const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未认证' });
    }

    const hasPermission = requiredPermissions.some(perm => 
      req.user.permissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ code: 403, message: '没有权限执行此操作' });
    }

    next();
  };
};

module.exports = { authenticateToken, checkPermission };

