const { createOssClient, ossConfig } = require('../config/oss');
const path = require('path');

class OssService {
  constructor() {
    this.oss = createOssClient();
  }

  // 生成上传文件的key（存储在media目录下，按用户和日期分类）
  generateKey(userId, filename) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const ext = path.extname(filename);
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    return `media/${userId}/${year}/${month}/${day}/${timestamp}-${randomStr}${ext}`;
  }

  // 生成预签名上传URL（前端直传OSS）
  async generateUploadUrl(key, contentType) {
    const options = {
      expires: 300, // 5分钟有效期
      method: 'PUT',
    };
    
    if (contentType) {
      options['Content-Type'] = contentType;
    }
    
    return this.oss.signatureUrl(key, options);
  }

  // 生成预签名访问URL
  async generateViewUrl(key, expires = 3600) {
    return this.oss.signatureUrl(key, { expires });
  }

  // 直接上传文件（后端上传）
  async uploadFile(key, file, options = {}) {
    return this.oss.put(key, file, options);
  }

  // 删除文件
  async deleteFile(key) {
    try {
      await this.oss.delete(key);
      return true;
    } catch (error) {
      console.error('删除OSS文件失败:', error);
      return false;
    }
  }

  // 检查文件是否存在
  async exists(key) {
    try {
      await this.oss.head(key);
      return true;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  // 获取文件的公开URL（如果桶是公开的）
  getPublicUrl(key) {
    return `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${key}`;
  }
}

const ossService = new OssService();

module.exports = { ossService, OssService };
