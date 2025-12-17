import { useState, useEffect } from 'react';
import { 
  Form, Input, Button, DatePicker, InputNumber, Card, 
  message, Table, Space, Modal, Tag 
} from 'antd';
import { SaveOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const DailyLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editVisible, setEditVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchLogs();
    loadTodayLog();
  }, [pagination.current, pagination.pageSize]);

  const loadTodayLog = async () => {
    try {
      const res = await request.get('/logs/today');
      if (res.data) {
        form.setFieldsValue({
          logDate: dayjs(res.data.log_date),
          content: res.data.content,
          workHours: res.data.work_hours
        });
      } else {
        form.setFieldsValue({
          logDate: dayjs(),
          content: '',
          workHours: 8
        });
      }
    } catch (error) {
      console.error('获取今日日志失败:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await request.get('/logs', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize
        }
      });
      setLogs(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取日志列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      await request.post('/logs', {
        logDate: values.logDate.format('YYYY-MM-DD'),
        content: values.content,
        workHours: values.workHours
      });
      
      message.success('日志保存成功');
      fetchLogs();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record) => {
    setCurrentLog(record);
    editForm.setFieldsValue({
      content: record.content,
      workHours: record.work_hours
    });
    setEditVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      await request.put(`/logs/${currentLog.id}`, {
        content: values.content,
        workHours: values.workHours
      });
      message.success('更新成功');
      setEditVisible(false);
      fetchLogs();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await request.delete(`/logs/${id}`);
      message.success('删除成功');
      fetchLogs();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'log_date',
      key: 'log_date',
      width: 120,
      render: (val) => dayjs(val).format('YYYY-MM-DD')
    },
    {
      title: '工作时长',
      dataIndex: 'work_hours',
      key: 'work_hours',
      width: 100,
      render: (val) => `${val} 小时`
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-card">
        <div className="page-card-header">
          <span className="page-card-title">写日志</span>
        </div>

        <Card style={{ maxWidth: 800 }}>
          <Form form={form} layout="vertical">
            <Space style={{ width: '100%', marginBottom: 16 }} size={16}>
              <Form.Item
                name="logDate"
                label="日期"
                rules={[{ required: true, message: '请选择日期' }]}
                style={{ marginBottom: 0 }}
              >
                <DatePicker style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                name="workHours"
                label="工作时长"
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0} max={24} step={0.5} addonAfter="小时" />
              </Form.Item>
            </Space>

            <Form.Item
              name="content"
              label="日志内容"
              rules={[{ required: true, message: '请填写日志内容' }]}
            >
              <Input.TextArea 
                rows={10} 
                placeholder="今天做了什么工作..."
                className="log-editor"
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                size="large"
              >
                保存日志
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <span className="page-card-title">我的日志记录</span>
        </div>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))}
        />
      </div>

      <Modal
        title="编辑日志"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleUpdate}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="workHours"
            label="工作时长"
          >
            <InputNumber min={0} max={24} step={0.5} addonAfter="小时" />
          </Form.Item>

          <Form.Item
            name="content"
            label="日志内容"
            rules={[{ required: true, message: '请填写日志内容' }]}
          >
            <Input.TextArea rows={8} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DailyLogs;

