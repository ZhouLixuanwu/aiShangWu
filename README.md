# 库存管理系统

一个完整的前后端分离的库存管理系统，支持用户权限管理、库存管理、库存变动审批、发货管理和工作日志功能。

## 技术栈

### 后端
- Node.js + Express
- MySQL (阿里云 RDS)
- JWT 认证
- bcrypt 密码加密

### 前端
- React 18 + Vite
- Ant Design 5.x
- React Router 6
- Zustand 状态管理
- Axios

## 功能模块

### 1. 用户权限系统
- 用户登录/登出
- 用户管理（创建、编辑、删除）
- 权限分配（支持多种权限组合）
- 基于权限的菜单和功能控制

### 2. 库存管理
- 商品管理（添加、编辑、删除）
- 商品分类
- 库存数量管理
- 库存预警

### 3. 库存变动
- 提交库存变动申请（入库/出库）
- 查看我的申请记录
- 审批管理（通过/拒绝）
- 审批后自动更新库存

### 4. 发货管理
- 查看已审批的出库记录
- 填写发货信息
- 更新快递单号
- 发货状态跟踪

### 5. 工作日志
- 每日日志填写
- 查看自己的日志历史
- 管理员查看团队日志

## 权限说明

| 权限代码 | 权限名称 | 说明 |
|---------|---------|------|
| user_manage | 用户管理 | 创建、编辑、删除用户 |
| user_view | 查看用户 | 查看用户列表 |
| inventory_manage | 库存管理 | 添加、编辑、删除商品和库存 |
| inventory_view | 查看库存 | 查看商品和库存信息 |
| stock_submit | 提交库存变动 | 提交库存变动申请 |
| stock_approve | 审批库存变动 | 审批库存变动申请 |
| stock_view_all | 查看所有变动记录 | 查看所有库存变动记录 |
| shipping_manage | 发货管理 | 填写发货信息和快递单号 |
| log_write | 写日志 | 填写每日工作日志 |
| log_view_all | 查看所有日志 | 查看所有人的工作日志 |

## 部署指南

### 1. 环境要求
- Node.js 18+
- MySQL 5.7+ 或 8.0
- npm 或 yarn

### 2. 后端部署

```bash
cd back

# 复制环境配置文件
cp .env.example .env

# 编辑 .env 文件，配置数据库连接等

# 安装依赖
npm install

# 初始化数据库
npm run db:init

# 启动服务
npm start

# 开发模式
npm run dev
```

### 3. 前端部署

```bash
cd front

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

### 4. 宝塔面板部署

#### 后端
1. 上传 `back` 目录到服务器
2. 在宝塔面板创建 Node.js 项目
3. 配置 `.env` 文件
4. 运行 `npm run db:init` 初始化数据库
5. 使用 PM2 启动服务

#### 前端
1. 本地运行 `npm run build` 构建
2. 上传 `dist` 目录到服务器
3. 在宝塔面板创建静态网站
4. 配置 Nginx 反向代理 API 请求到后端

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /www/wwwroot/front/dist;
    index index.html;
    
    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 默认账号

初始化后，系统会创建一个管理员账号：
- 用户名: `admin`
- 密码: `admin123`

**请登录后立即修改密码！**

## 目录结构

```
├── back/                   # 后端项目
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── database/       # 数据库相关
│   │   ├── middleware/     # 中间件
│   │   ├── routes/         # 路由
│   │   ├── utils/          # 工具函数
│   │   └── app.js          # 入口文件
│   ├── .env.example        # 环境变量示例
│   └── package.json
│
├── front/                  # 前端项目
│   ├── src/
│   │   ├── layouts/        # 布局组件
│   │   ├── pages/          # 页面组件
│   │   ├── store/          # 状态管理
│   │   ├── styles/         # 样式文件
│   │   ├── utils/          # 工具函数
│   │   ├── App.jsx         # 根组件
│   │   └── main.jsx        # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## License

MIT

