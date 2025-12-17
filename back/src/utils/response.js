/**
 * 统一响应格式
 */

const success = (res, data = null, message = '操作成功') => {
  res.json({
    code: 200,
    message,
    data
  });
};

const created = (res, data = null, message = '创建成功') => {
  res.status(201).json({
    code: 201,
    message,
    data
  });
};

const error = (res, message = '操作失败', code = 400) => {
  res.status(code).json({
    code,
    message,
    data: null
  });
};

const paginate = (res, list, total, page, pageSize) => {
  res.json({
    code: 200,
    message: '获取成功',
    data: {
      list,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      }
    }
  });
};

module.exports = { success, created, error, paginate };

