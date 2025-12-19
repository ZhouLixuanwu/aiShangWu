import { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Switch, Checkbox, 
  Space, Tag, message, Popconfirm, Row, Col, Divider 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, [pagination.current, pagination.pageSize]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await request.get('/users', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          keyword: searchKeyword
        }
      });
      setUsers(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await request.get('/users/permissions');
      setPermissions(res.data || []);
    } catch (error) {
      console.error('获取权限列表失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchUsers();
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ status: true, permissions: [] });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      realName: record.realName,
      email: record.email,
      phone: record.phone,
      status: record.status === 1,
      permissions: record.permissions || []
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await request.delete(`/users/${id}`);
      message.success('删除成功');
      fetchUsers();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        status: values.status ? 1 : 0
      };

      if (editingUser) {
        await request.put(`/users/${editingUser.id}`, data);
        message.success('更新成功');
      } else {
        await request.post('/users', data);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const showResetPassword = (record) => {
    setEditingUser(record);
    passwordForm.resetFields();
    setPasswordVisible(true);
  };

  const handleResetPassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      await request.put(`/users/${editingUser.id}/password`, {
        password: values.password
      });
      message.success('密码重置成功');
      setPasswordVisible(false);
    } catch (error) {
      console.error('重置密码失败:', error);
    }
  };

  // 按分类分组权限
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const category = perm.category || '其他';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {});

  // 角色颜色映射
  const roleColorMap = {
    'admin': 'red',
    'leader': 'blue',
    'salesman': 'green'
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      key: 'realName',
      width: 100,
    },
    {
      title: '角色',
      dataIndex: 'userType',
      key: 'userType',
      width: 100,
      render: (type, record) => (
        <Tag color={roleColorMap[type] || 'default'}>
          {record.userTypeName || '业务员'}
        </Tag>
      )
    },
    {
      title: '所属组长',
      dataIndex: 'leaderName',
      key: 'leaderName',
      width: 100,
      render: (val, record) => record.userType === 'salesman' ? (val || '-') : '-'
    },
    {
      title: '手机',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (val) => val || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val) => (
        <Tag color={val === 1 ? 'green' : 'default'}>
          {val === 1 ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '权限',
      dataIndex: 'permissionNames',
      key: 'permissionNames',
      width: 180,
      render: (perms) => (
        <Space wrap size={[0, 4]}>
          {(perms || []).slice(0, 2).map((p, i) => (
            <Tag key={i} color="blue">{p}</Tag>
          ))}
          {perms?.length > 2 && <Tag>+{perms.length - 2}</Tag>}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" icon={<KeyOutlined />} onClick={() => showResetPassword(record)}>
            重置密码
          </Button>
          {record.id !== 1 && (
            <Popconfirm
              title="确定删除此用户？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">用户管理</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加用户
        </Button>
      </div>

      <div className="search-bar">
        <Input
          placeholder="搜索用户名或姓名"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 300 }}
          suffix={<SearchOutlined onClick={handleSearch} style={{ cursor: 'pointer' }} />}
        />
        <Button onClick={handleSearch}>搜索</Button>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="realName"
                label="真实姓名"
              >
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能少于6位' }
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="手机">
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Divider>权限设置</Divider>

          <Form.Item name="permissions">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <Col span={12} key={category}>
                    <div style={{ 
                      border: '1px solid #f0f0f0', 
                      borderRadius: 8, 
                      padding: 16,
                      background: '#fafafa',
                      height: '100%'
                    }}>
                      <div style={{ 
                        fontWeight: 600, 
                        marginBottom: 12, 
                        color: '#1890ff',
                        borderBottom: '1px solid #e8e8e8',
                        paddingBottom: 8
                      }}>
                        {category}
                      </div>
                      <Space direction="vertical" size={8}>
                        {perms.map(perm => (
                          <Checkbox key={perm.code} value={perm.code}>
                            {perm.name}
                          </Checkbox>
                        ))}
                      </Space>
                    </div>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={passwordVisible}
        onOk={handleResetPassword}
        onCancel={() => setPasswordVisible(false)}
        okText="确认重置"
      >
        <p>为用户 <strong>{editingUser?.username}</strong> 重置密码</p>
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;

