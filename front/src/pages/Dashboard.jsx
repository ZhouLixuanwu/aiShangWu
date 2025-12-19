import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Empty } from 'antd';
import {
  ShoppingOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CarOutlined
} from '@ant-design/icons';
import request from '../utils/request';
import useUserStore from '../store/userStore';
import dayjs from 'dayjs';

const Dashboard = () => {
  const { user, hasPermission } = useUserStore();
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingRequests: 0,
    todayApproved: 0,
    pendingShipping: 0
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 获取统计数据
      const statsRes = await request.get('/stats/dashboard');
      setStats(statsRes.data || {
        totalProducts: 0,
        pendingRequests: 0,
        todayApproved: 0,
        pendingShipping: 0
      });

      // 获取最近的申请记录
      if (hasPermission('stock_submit')) {
        const res = await request.get('/stock-requests', {
          params: { page: 1, pageSize: 5, my: '1' }
        });
        setRecentRequests(res.data.list || []);
      }

    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'gold', text: '待审批' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div>
      <div className="page-card">
        <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
          欢迎回来，{user?.realName || user?.username}
        </h2>
        
        <Row gutter={[24, 24]}>
          {hasPermission(['inventory_view', 'inventory_manage']) && (
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="商品总数"
                  value={stats.totalProducts}
                  prefix={<ShoppingOutlined style={{ color: '#1677ff' }} />}
                />
              </Card>
            </Col>
          )}
          
          {hasPermission('stock_approve') && (
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="待审批"
                  value={stats.pendingRequests}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
          )}
          
          {hasPermission('stock_view_all') && (
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="今日审批"
                  value={stats.todayApproved}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
          )}
          
          {hasPermission('shipping_manage') && (
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="待发货"
                  value={stats.pendingShipping}
                  prefix={<CarOutlined style={{ color: '#722ed1' }} />}
                />
              </Card>
            </Col>
          )}
        </Row>
      </div>

      {hasPermission('stock_submit') && (
        <div className="page-card">
          <div className="page-card-header">
            <span className="page-card-title">我的最近申请</span>
          </div>
          
          {recentRequests.length > 0 ? (
            <List
              dataSource={recentRequests}
              renderItem={(item) => {
                // 显示商品信息
                const itemsDisplay = item.items && item.items.length > 0
                  ? item.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')
                  : item.items_summary || item.product_name || '未知商品';
                
                return (
                  <List.Item
                    extra={getStatusTag(item.status)}
                  >
                    <List.Item.Meta
                      title={`${itemsDisplay} - ${item.type === 'out' ? '出库' : '入库'}`}
                      description={
                        <span style={{ color: '#999' }}>
                          {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                          {item.merchant && ` · ${item.merchant}`}
                        </span>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          ) : (
            <Empty description="暂无申请记录" />
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

