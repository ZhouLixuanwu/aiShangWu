import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Space, Badge, Drawer } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  SwapOutlined,
  CarOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  EditOutlined,
  UnorderedListOutlined,
  EyeOutlined,
  PictureOutlined,
  UploadOutlined,
  CloseOutlined,
  AudioOutlined,
  BookOutlined,
  FormOutlined,
  AuditOutlined,
  GlobalOutlined,
  ShopOutlined,
  SolutionOutlined
} from '@ant-design/icons';
import useUserStore from '../store/userStore';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useUserStore();

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 移动端默认折叠
      if (mobile) {
        setCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    hasPermission(['inventory_view', 'inventory_manage']) && {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: '商品管理',
    },
    (hasPermission('stock_submit') || hasPermission('stock_approve')) && {
      key: 'stock',
      icon: <SwapOutlined />,
      label: '库存变动',
      children: [
        hasPermission('stock_submit') && {
          key: '/stock-requests',
          icon: <EditOutlined />,
          label: '提交变动',
        },
        hasPermission('stock_submit') && {
          key: '/my-requests',
          icon: <UnorderedListOutlined />,
          label: '我的申请',
        },
        hasPermission('stock_approve') && {
          key: '/pending-approvals',
          icon: <AuditOutlined />,
          label: '待审批',
        },
      ].filter(Boolean),
    },
    hasPermission('stock_view_all') && {
      key: '/stock-overview',
      icon: <EyeOutlined />,
      label: '订单总览',
    },
    hasPermission('shipping_manage') && {
      key: '/shipping',
      icon: <CarOutlined />,
      label: '发货管理',
    },
    hasPermission('log_write') && {
      key: 'logs',
      icon: <FileTextOutlined />,
      label: '工作日志',
      children: [
        {
          key: '/daily-logs',
          icon: <EditOutlined />,
          label: '写日志',
        },
        hasPermission('log_view_all') && {
          key: '/team-logs',
          icon: <TeamOutlined />,
          label: '团队日志',
        },
      ].filter(Boolean),
    },
    
    (hasPermission('media_upload') || hasPermission('media_view_team') || hasPermission('media_view_all') || hasPermission('voice_edit') || hasPermission('copywriting_manage') || hasPermission('copywriting_edit')) && {
      key: 'media',
      icon: <PictureOutlined />,
      label: '素材管理',
      children: [
        hasPermission('media_upload') && {
          key: '/media-upload',
          icon: <UploadOutlined />,
          label: '上传素材',
        },
        hasPermission('media_view_team') && {
          key: '/team-media',
          icon: <TeamOutlined />,
          label: '团队素材',
        },
        hasPermission('media_view_all') && {
          key: '/all-media',
          icon: <GlobalOutlined />,
          label: '全员素材',
        },
        hasPermission('voice_edit') && {
          key: '/voice-edit',
          icon: <AudioOutlined />,
          label: '声音剪辑',
        },
        hasPermission('copywriting_manage') && {
          key: '/copywriting-library',
          icon: <BookOutlined />,
          label: '文案库',
        },
        hasPermission('copywriting_edit') && {
          key: '/media-copywriting',
          icon: <FormOutlined />,
          label: '素材文案',
        },
      ].filter(Boolean),
    },
    (hasPermission('merchant_upload') || hasPermission('merchant_view_all')) && {
      key: 'merchant',
      icon: <ShopOutlined />,
      label: '办理营业执照',
      children: [
        hasPermission('merchant_upload') && {
          key: '/merchant-register',
          icon: <UploadOutlined />,
          label: '提交入驻',
        },
        hasPermission('merchant_view_all') && {
          key: '/merchant-list',
          icon: <SolutionOutlined />,
          label: '入驻管理',
        },
      ].filter(Boolean),
    },
    hasPermission('user_manage') && {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
  ].filter(Boolean);

  const handleMenuClick = ({ key }) => {
    navigate(key);
    // 移动端点击菜单后自动关闭抽屉
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const getSelectedKeys = () => {
    const path = location.pathname;
    return [path];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.includes('stock-requests') || path.includes('my-requests') || path.includes('pending-approvals')) {
      return ['stock'];
    }
    if (path.includes('logs')) {
      return ['logs'];
    }
    if (path.includes('media') || path.includes('copywriting')) {
      return ['media'];
    }
    if (path.includes('merchant')) {
      return ['merchant'];
    }
    return [];
  };

  // 菜单内容
  const menuContent = (
    <>
      <div className="logo-container">
        <h2>{isMobile ? '商务部门管理系统' : (collapsed ? '商务' : '商务部门管理系统')}</h2>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </>
  );

  return (
    <Layout className="layout-container">
      {/* 移动端使用抽屉模式 */}
      {isMobile ? (
        <Drawer
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={260}
          closable={false}
          styles={{
            body: { padding: 0, background: '#001529' },
            header: { display: 'none' }
          }}
        >
          <div style={{ 
            position: 'absolute', 
            right: 12, 
            top: 12, 
            zIndex: 10,
            color: '#fff',
            fontSize: 18,
            cursor: 'pointer'
          }} onClick={() => setDrawerVisible(false)}>
            <CloseOutlined />
          </div>
          {menuContent}
        </Drawer>
      ) : (
        <Sider 
          className="layout-sider" 
          width={220}
          collapsed={collapsed}
          collapsedWidth={80}
        >
          {menuContent}
        </Sider>
      )}
      
      <Layout 
        className="layout-content" 
        style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 220) }}
      >
        <Header className="layout-header">
          <Space>
            {isMobile ? (
              <MenuUnfoldOutlined 
                style={{ fontSize: 18, cursor: 'pointer' }}
                onClick={() => setDrawerVisible(true)}
              />
            ) : collapsed ? (
              <MenuUnfoldOutlined 
                style={{ fontSize: 18, cursor: 'pointer' }}
                onClick={() => setCollapsed(false)}
              />
            ) : (
              <MenuFoldOutlined 
                style={{ fontSize: 18, cursor: 'pointer' }}
                onClick={() => setCollapsed(true)}
              />
            )}
          </Space>
          
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar 
                style={{ backgroundColor: '#1677ff' }} 
                icon={<UserOutlined />}
              />
              <span>{user?.realName || user?.username || '用户'}</span>
            </Space>
          </Dropdown>
        </Header>
        
        <Content className="layout-main">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;

