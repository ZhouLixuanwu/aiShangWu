const OSS = require('ali-oss');

const ossConfig = {
  region: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: process.env.ALIYUN_OSS_BUCKET || 'aishangwu-houtai',
  endpoint: process.env.ALIYUN_OSS_ENDPOINT || 'https://oss-cn-hangzhou.aliyuncs.com',
  secure: true
};

const createOssClient = () => {
  return new OSS({
    region: ossConfig.region,
    accessKeyId: ossConfig.accessKeyId,
    accessKeySecret: ossConfig.accessKeySecret,
    bucket: ossConfig.bucket,
  });
};

module.exports = { ossConfig, createOssClient };
