-- ===========================================
-- 创建媒体上传表
-- ===========================================

CREATE TABLE IF NOT EXISTS `media_uploads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '上传者ID（业务员）',
  `user_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '上传者姓名',
  `leader_id` int DEFAULT NULL COMMENT '所属组长ID',
  `oss_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'OSS文件key',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `file_type` enum('image','video') COLLATE utf8mb4_unicode_ci DEFAULT 'image' COMMENT '文件类型',
  `file_size` bigint DEFAULT 0 COMMENT '文件大小（字节）',
  `upload_date` date NOT NULL COMMENT '上传日期（用于统计）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`, `upload_date`),
  KEY `idx_leader_date` (`leader_id`, `upload_date`),
  KEY `idx_upload_date` (`upload_date`),
  CONSTRAINT `media_uploads_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `media_uploads_ibfk_2` FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='多媒体素材上传记录';

-- 添加权限
INSERT IGNORE INTO `permissions` (`code`, `name`, `description`, `category`) VALUES
('media_upload', '素材上传', '上传图片视频素材', '素材管理'),
('media_view_team', '查看团队素材', '查看下属业务员上传的素材', '素材管理');

-- 给管理员添加权限
INSERT IGNORE INTO `user_permissions` (`user_id`, `permission_id`)
SELECT 1, id FROM permissions WHERE code IN ('media_upload', 'media_view_team');

SELECT '媒体上传表创建完成！' AS message;
