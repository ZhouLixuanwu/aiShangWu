-- ===========================================
-- 创建文案模版表和相关字段
-- ===========================================

-- 1. 创建文案模版表
CREATE TABLE IF NOT EXISTS `copywriting_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模版标题',
  `category` enum('product','activity','daily','festival','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other' COMMENT '分类：产品推广/活动宣传/日常分享/节日祝福/其他',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文案内容',
  `use_count` int DEFAULT 0 COMMENT '使用次数',
  `created_by` int DEFAULT NULL COMMENT '创建者ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_use_count` (`use_count`),
  CONSTRAINT `copywriting_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文案模版库';

-- 2. 给素材表添加文案相关字段
ALTER TABLE `media_uploads` 
ADD COLUMN `copywriting` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配套文案' AFTER `file_size`,
ADD COLUMN `copywriting_updated_at` timestamp NULL DEFAULT NULL COMMENT '文案更新时间' AFTER `copywriting`,
ADD COLUMN `copywriting_updated_by` int DEFAULT NULL COMMENT '文案更新者ID' AFTER `copywriting_updated_at`;

-- 3. 添加索引以支持文案筛选
ALTER TABLE `media_uploads` 
ADD INDEX `idx_copywriting` ((`copywriting` IS NOT NULL));

-- 4. 添加权限
INSERT IGNORE INTO `permissions` (`code`, `name`, `description`, `category`) VALUES
('copywriting_manage', '文案库管理', '管理文案模版（增删改查）', '素材管理'),
('copywriting_edit', '素材文案编辑', '为素材配置文案', '素材管理');

-- 5. 给管理员添加权限（假设管理员ID为1）
INSERT IGNORE INTO `user_permissions` (`user_id`, `permission_id`)
SELECT 1, id FROM permissions WHERE code IN ('copywriting_manage', 'copywriting_edit');

-- 6. 插入一些示例文案模版
INSERT INTO `copywriting_templates` (`title`, `category`, `content`, `created_by`) VALUES
('产品展示通用', 'product', '🔥 新品上线！\n\n这款产品真的太棒了！\n✅ 高品质材料\n✅ 精心设计\n✅ 超高性价比\n\n限时优惠，赶快下单吧！', 1),
('活动促销', 'activity', '🎉 重磅活动来袭！\n\n限时特惠，不容错过～\n📅 活动时间：即日起\n🎁 超值福利等你来拿\n\n点击链接立即参与 👇', 1),
('日常种草', 'daily', '今日份好物分享 ✨\n\n用了一段时间，真心推荐给大家！\n💝 使用体验超级好\n💝 颜值在线\n💝 回购无数次\n\n姐妹们快冲！', 1),
('节日祝福通用', 'festival', '🎊 节日快乐！\n\n在这个特别的日子里，祝大家：\n🌟 身体健康\n🌟 万事如意\n🌟 阖家幸福\n\n感谢一路有你们的支持！❤️', 1);

SELECT '文案模版表创建完成！' AS message;
