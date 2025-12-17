/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = daily_logs   */
/******************************************/
CREATE TABLE `daily_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `log_date` date NOT NULL COMMENT '日志日期',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '日志内容',
  `work_hours` decimal(4,1) DEFAULT '8.0' COMMENT '工作时长',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`log_date`),
  CONSTRAINT `daily_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = operation_logs   */
/******************************************/
CREATE TABLE `operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL COMMENT '操作用户ID',
  `username` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作用户名',
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型',
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '目标类型',
  `target_id` int DEFAULT NULL COMMENT '目标ID',
  `detail` text COLLATE utf8mb4_unicode_ci COMMENT '操作详情',
  `ip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `operation_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = permissions   */
/******************************************/
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限代码',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '权限名称',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '权限描述',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '权限分类',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = products   */
/******************************************/
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品名称',
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品编码',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品分类',
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '个' COMMENT '单位',
  `price` decimal(10,2) DEFAULT '0.00' COMMENT '单价',
  `stock` int DEFAULT '0' COMMENT '库存数量',
  `min_stock` int DEFAULT '0' COMMENT '最低库存预警',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '商品描述',
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品图片',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-下架, 1-上架',
  `created_by` int DEFAULT NULL COMMENT '创建人',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = shipping_info   */
/******************************************/
CREATE TABLE `shipping_info` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL COMMENT '关联的申请单ID',
  `shipping_status` enum('pending','shipped','delivered') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '发货状态',
  `tracking_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '快递单号',
  `courier_company` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '快递公司',
  `shipping_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货地址',
  `receiver_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货人',
  `receiver_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货人电话',
  `shipped_at` timestamp NULL DEFAULT NULL COMMENT '发货时间',
  `delivered_at` timestamp NULL DEFAULT NULL COMMENT '签收时间',
  `remark` text COLLATE utf8mb4_unicode_ci COMMENT '发货备注',
  `operator_id` int DEFAULT NULL COMMENT '操作人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_id` (`request_id`),
  KEY `operator_id` (`operator_id`),
  CONSTRAINT `shipping_info_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `stock_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shipping_info_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = stock_requests   */
/******************************************/
CREATE TABLE `stock_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_no` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '申请单号',
  `product_id` int NOT NULL COMMENT '商品ID',
  `quantity` int NOT NULL COMMENT '变动数量（负数表示减少）',
  `type` enum('in','out') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型: in-入库, out-出库',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '变动原因',
  `merchant` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商家名称',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地址',
  `remark` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'approved' COMMENT '状态（默认直接通过，无需审核）',
  `submitter_id` int NOT NULL COMMENT '提交人ID',
  `submitter_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '提交人姓名',
  `salesman_id` int DEFAULT NULL COMMENT '业务员ID（发起人）',
  `salesman_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '业务员姓名',
  `approver_id` int DEFAULT NULL COMMENT '审批人ID',
  `approver_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '审批人姓名',
  `approved_at` timestamp NULL DEFAULT NULL COMMENT '审批时间',
  `reject_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拒绝原因',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_no` (`request_no`),
  KEY `product_id` (`product_id`),
  KEY `submitter_id` (`submitter_id`),
  KEY `approver_id` (`approver_id`),
  KEY `salesman_id` (`salesman_id`),
  CONSTRAINT `stock_requests_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_requests_ibfk_2` FOREIGN KEY (`submitter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_requests_ibfk_3` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_requests_ibfk_4` FOREIGN KEY (`salesman_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = users   */
/******************************************/
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户名',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '密码',
  `real_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '真实姓名',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号',
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像',
  `user_type` enum('admin','leader','salesman') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'salesman' COMMENT '用户类型: admin-管理员, leader-商务/组长, salesman-业务员',
  `leader_id` int DEFAULT NULL COMMENT '所属组长ID（业务员专用）',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `leader_id` (`leader_id`),
  CONSTRAINT `users_ibfk_leader` FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;

/******************************************/
/*   DatabaseName = aishangwu   */
/*   TableName = user_permissions   */
/******************************************/
CREATE TABLE `user_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_permission` (`user_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `user_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
;
