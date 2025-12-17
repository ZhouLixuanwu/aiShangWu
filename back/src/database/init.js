/**
 * 数据库初始化脚本
 * 运行: npm run db:init
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('🔗 连接数据库成功，开始初始化表结构...');

  const sql = `
    -- 权限表
    CREATE TABLE IF NOT EXISTS permissions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL COMMENT '权限代码',
      name VARCHAR(100) NOT NULL COMMENT '权限名称',
      description VARCHAR(255) COMMENT '权限描述',
      category VARCHAR(50) COMMENT '权限分类',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
      password VARCHAR(255) NOT NULL COMMENT '密码',
      real_name VARCHAR(100) COMMENT '真实姓名',
      email VARCHAR(100) COMMENT '邮箱',
      phone VARCHAR(20) COMMENT '手机号',
      avatar VARCHAR(255) COMMENT '头像',
      status TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 用户权限关联表
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      permission_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_permission (user_id, permission_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 商品表
    CREATE TABLE IF NOT EXISTS products (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL COMMENT '商品名称',
      sku VARCHAR(100) UNIQUE COMMENT '商品编码',
      category VARCHAR(100) COMMENT '商品分类',
      unit VARCHAR(50) DEFAULT '个' COMMENT '单位',
      price DECIMAL(10,2) DEFAULT 0 COMMENT '单价',
      stock INT DEFAULT 0 COMMENT '库存数量',
      min_stock INT DEFAULT 0 COMMENT '最低库存预警',
      description TEXT COMMENT '商品描述',
      image VARCHAR(255) COMMENT '商品图片',
      status TINYINT DEFAULT 1 COMMENT '状态: 0-下架, 1-上架',
      created_by INT COMMENT '创建人',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 库存变动申请表
    CREATE TABLE IF NOT EXISTS stock_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_no VARCHAR(50) UNIQUE NOT NULL COMMENT '申请单号',
      product_id INT NOT NULL COMMENT '商品ID',
      quantity INT NOT NULL COMMENT '变动数量（负数表示减少）',
      type ENUM('in', 'out') NOT NULL COMMENT '类型: in-入库, out-出库',
      reason VARCHAR(255) COMMENT '变动原因',
      merchant VARCHAR(100) COMMENT '商家名称',
      address VARCHAR(255) COMMENT '地址',
      remark TEXT COMMENT '备注',
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '状态',
      submitter_id INT NOT NULL COMMENT '提交人ID',
      submitter_name VARCHAR(100) COMMENT '提交人姓名',
      approver_id INT COMMENT '审批人ID',
      approver_name VARCHAR(100) COMMENT '审批人姓名',
      approved_at TIMESTAMP NULL COMMENT '审批时间',
      reject_reason VARCHAR(255) COMMENT '拒绝原因',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 发货信息表
    CREATE TABLE IF NOT EXISTS shipping_info (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_id INT UNIQUE NOT NULL COMMENT '关联的申请单ID',
      shipping_status ENUM('pending', 'shipped', 'delivered') DEFAULT 'pending' COMMENT '发货状态',
      tracking_no VARCHAR(100) COMMENT '快递单号',
      courier_company VARCHAR(100) COMMENT '快递公司',
      shipping_address VARCHAR(255) COMMENT '收货地址',
      receiver_name VARCHAR(100) COMMENT '收货人',
      receiver_phone VARCHAR(20) COMMENT '收货人电话',
      shipped_at TIMESTAMP NULL COMMENT '发货时间',
      delivered_at TIMESTAMP NULL COMMENT '签收时间',
      remark TEXT COMMENT '发货备注',
      operator_id INT COMMENT '操作人ID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES stock_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 日志表
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL COMMENT '用户ID',
      log_date DATE NOT NULL COMMENT '日志日期',
      content TEXT NOT NULL COMMENT '日志内容',
      work_hours DECIMAL(4,1) DEFAULT 8 COMMENT '工作时长',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_date (user_id, log_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 操作日志表
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT COMMENT '操作用户ID',
      username VARCHAR(50) COMMENT '操作用户名',
      action VARCHAR(100) NOT NULL COMMENT '操作类型',
      target_type VARCHAR(50) COMMENT '目标类型',
      target_id INT COMMENT '目标ID',
      detail TEXT COMMENT '操作详情',
      ip VARCHAR(50) COMMENT 'IP地址',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 插入默认权限
    INSERT IGNORE INTO permissions (code, name, description, category) VALUES
    ('user_manage', '用户管理', '创建、编辑、删除用户', '系统管理'),
    ('user_view', '查看用户', '查看用户列表', '系统管理'),
    ('inventory_manage', '库存管理', '添加、编辑、删除商品和库存', '库存管理'),
    ('inventory_view', '查看库存', '查看商品和库存信息', '库存管理'),
    ('stock_submit', '提交库存变动', '提交库存变动申请', '库存管理'),
    ('stock_approve', '审批库存变动', '审批库存变动申请', '库存管理'),
    ('stock_view_all', '查看所有变动记录', '查看所有库存变动记录', '库存管理'),
    ('shipping_manage', '发货管理', '填写发货信息和快递单号', '物流管理'),
    ('log_write', '写日志', '填写每日工作日志', '日志管理'),
    ('log_view_all', '查看所有日志', '查看所有人的工作日志', '日志管理');

    -- 插入默认管理员账号 (密码: admin123)
    -- 密码会在下面用bcrypt生成
    INSERT IGNORE INTO users (id, username, password, real_name, status) VALUES
    (1, 'admin', 'TEMP_PASSWORD', '系统管理员', 1);
  `;

  try {
    await connection.query(sql);
    console.log('✅ 数据库表创建成功！');

    // 使用bcrypt生成管理员密码
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // 更新管理员密码
    await connection.query(
      'UPDATE users SET password = ? WHERE id = 1',
      [hashedPassword]
    );
    console.log('✅ 管理员账号创建成功！(用户名: admin, 密码: admin123)');

    // 为管理员赋予所有权限
    const [permissions] = await connection.query('SELECT id FROM permissions');
    for (const perm of permissions) {
      await connection.query(
        'INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (1, ?)',
        [perm.id]
      );
    }
    console.log('✅ 管理员权限配置完成！');

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
  } finally {
    await connection.end();
    console.log('🔒 数据库连接已关闭');
  }
};

initDatabase();

