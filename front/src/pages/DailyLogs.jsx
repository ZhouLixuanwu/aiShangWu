import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Form, Button, DatePicker, InputNumber, Card, 
  message, Table, Space, Modal 
} from 'antd';
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

// wangeditor 富文本编辑器
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';

// 获取API基础URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// 草稿存储的 localStorage key
const DRAFT_KEY = 'daily_log_draft';

const DailyLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editVisible, setEditVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 写日志的编辑器
  const [editor, setEditor] = useState(null);
  const [html, setHtml] = useState('');

  // 编辑日志的编辑器
  const [editEditor, setEditEditor] = useState(null);
  const [editHtml, setEditHtml] = useState('');

  // 自动保存状态
  const saveTimerRef = useRef(null);
  const isInitializedRef = useRef(false);

  // 获取token的辅助函数
  const getAuthToken = () => {
    return localStorage.getItem('token') || '';
  };

  // 保存草稿到 localStorage
  const saveDraft = useCallback(() => {
    try {
      const formValues = form.getFieldsValue();
      const draft = {
        content: html,
        logDate: formValues.logDate ? formValues.logDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        workHours: formValues.workHours || 8,
        savedAt: new Date().toISOString()
      };
      
      // 只有内容不为空时才保存
      if (html && html !== '<p><br></p>' && html !== '<p></p>') {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
    }
  }, [html, form]);

  // 加载草稿
  const loadDraft = useCallback(() => {
    try {
      const draftStr = localStorage.getItem(DRAFT_KEY);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        return draft;
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    }
    return null;
  }, []);

  // 清除草稿
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // 自定义图片上传函数
  const customUploadImage = (file, insertFn) => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('originalName', file.name);

    // 使用 fetch 上传图片
    fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.code === 201 || data.code === 200) {
          // 上传成功，插入图片
          const url = data.data?.url || data.data?.fileUrl;
          insertFn(url, file.name, url);
          message.success('图片上传成功');
        } else {
          message.error(data.message || '图片上传失败');
        }
      })
      .catch(err => {
        console.error('图片上传失败:', err);
        message.error('图片上传失败');
      });
  };

  // 编辑器配置
  const toolbarConfig = {
    excludeKeys: [
      'uploadVideo',
      'insertVideo',
      'group-video',
      'fullScreen'
    ]
  };

  const editorConfig = {
    placeholder: '今天做了什么工作...',
    MENU_CONF: {
      uploadImage: {
        // 自定义上传图片
        customUpload: customUploadImage,
        // 限制图片大小 10MB
        maxFileSize: 10 * 1024 * 1024,
        // 允许的图片类型
        allowedFileTypes: ['image/*'],
        // 上传前的回调
        onBeforeUpload(file) {
          if (file.size > 10 * 1024 * 1024) {
            message.error('图片大小不能超过10MB');
            return false;
          }
          return file;
        },
        // 上传失败的回调
        onError(file, err) {
          console.error('上传失败:', err);
          message.error('图片上传失败');
        }
      }
    }
  };

  const editEditorConfig = {
    placeholder: '请输入日志内容...',
    MENU_CONF: {
      uploadImage: {
        customUpload: customUploadImage,
        maxFileSize: 10 * 1024 * 1024,
        allowedFileTypes: ['image/*'],
        onBeforeUpload(file) {
          if (file.size > 10 * 1024 * 1024) {
            message.error('图片大小不能超过10MB');
            return false;
          }
          return file;
        },
        onError(file, err) {
          console.error('上传失败:', err);
          message.error('图片上传失败');
        }
      }
    }
  };

  // 销毁编辑器
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
        setEditor(null);
      }
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      if (editEditor) {
        editEditor.destroy();
        setEditEditor(null);
      }
    };
  }, [editEditor]);

  // 初始化：加载草稿或今日日志
  useEffect(() => {
    fetchLogs();
    
    // 检查是否有草稿
    const draft = loadDraft();
    if (draft && draft.content && draft.content !== '<p><br></p>') {
      // 有草稿，使用草稿内容
      form.setFieldsValue({
        logDate: dayjs(draft.logDate),
        workHours: draft.workHours
      });
      setHtml(draft.content);
      isInitializedRef.current = true;
    } else {
      // 没有草稿，加载今日日志
      loadTodayLog();
    }
  }, []);

  // 分页变化时获取日志列表
  useEffect(() => {
    if (isInitializedRef.current) {
      fetchLogs();
    }
  }, [pagination.current, pagination.pageSize]);

  // 内容变化时自动保存草稿（防抖）
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 2秒后自动保存
    saveTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 2000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [html, saveDraft]);

  // 页面关闭/离开前保存草稿
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (html && html !== '<p><br></p>' && html !== '<p></p>') {
        saveDraft();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 组件卸载时也保存
      if (html && html !== '<p><br></p>' && html !== '<p></p>') {
        saveDraft();
      }
    };
  }, [html, saveDraft]);

  const loadTodayLog = async () => {
    try {
      const res = await request.get('/logs/today');
      if (res.data) {
        form.setFieldsValue({
          logDate: dayjs(res.data.log_date),
          workHours: res.data.work_hours
        });
        setHtml(res.data.content || '');
      } else {
        form.setFieldsValue({
          logDate: dayjs(),
          workHours: 8
        });
        setHtml('');
      }
      isInitializedRef.current = true;
    } catch (error) {
      console.error('获取今日日志失败:', error);
      isInitializedRef.current = true;
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
      
      if (!html || html === '<p><br></p>') {
        message.warning('请填写日志内容');
        return;
      }
      
      setSaving(true);
      
      await request.post('/logs', {
        logDate: values.logDate.format('YYYY-MM-DD'),
        content: html,
        workHours: values.workHours
      });
      
      message.success('日志保存成功');
      
      // 保存成功后清除草稿
      clearDraft();
      
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
      workHours: record.work_hours
    });
    setEditHtml(record.content || '');
    setEditVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      
      if (!editHtml || editHtml === '<p><br></p>') {
        message.warning('请填写日志内容');
        return;
      }
      
      await request.put(`/logs/${currentLog.id}`, {
        content: editHtml,
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

  // 关闭编辑弹窗时销毁编辑器
  const handleEditCancel = () => {
    setEditVisible(false);
    setEditHtml('');
    if (editEditor) {
      editEditor.destroy();
      setEditEditor(null);
    }
  };

  // 递归解码HTML实体（处理多重转义的情况）
  const decodeHtml = (htmlStr) => {
    if (!htmlStr) return '';
    const textarea = document.createElement('textarea');
    let decoded = htmlStr;
    let prevDecoded = '';
    
    // 循环解码，直到没有更多需要解码的内容
    while (decoded !== prevDecoded) {
      prevDecoded = decoded;
      textarea.innerHTML = decoded;
      decoded = textarea.value;
    }
    
    return decoded;
  };

  // 从HTML中提取纯文本用于表格显示
  const stripHtml = (htmlStr) => {
    if (!htmlStr) return '';
    // 先解码 HTML 实体
    const decoded = decodeHtml(htmlStr);
    const tmp = document.createElement('div');
    tmp.innerHTML = decoded;
    return tmp.textContent || tmp.innerText || '';
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
      ellipsis: true,
      render: (val) => {
        const text = stripHtml(val);
        return text.length > 80 ? text.substring(0, 80) + '...' : text;
      }
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
          {/* <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button> */}
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

        <Card style={{ maxWidth: 900 }}>
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

            <Form.Item label="日志内容" required>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
                <Toolbar
                  editor={editor}
                  defaultConfig={toolbarConfig}
                  mode="default"
                  style={{ borderBottom: '1px solid #d9d9d9' }}
                />
                <Editor
                  defaultConfig={editorConfig}
                  value={html}
                  onCreated={setEditor}
                  onChange={(editor) => setHtml(editor.getHtml())}
                  mode="default"
                  style={{ height: '300px', overflowY: 'hidden' }}
                />
              </div>
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
        onCancel={handleEditCancel}
        onOk={handleUpdate}
        width={700}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="workHours"
            label="工作时长"
          >
            <InputNumber min={0} max={24} step={0.5} addonAfter="小时" />
          </Form.Item>

          <Form.Item label="日志内容" required>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
              <Toolbar
                editor={editEditor}
                defaultConfig={toolbarConfig}
                mode="default"
                style={{ borderBottom: '1px solid #d9d9d9' }}
              />
              <Editor
                defaultConfig={editEditorConfig}
                value={editHtml}
                onCreated={setEditEditor}
                onChange={(editor) => setEditHtml(editor.getHtml())}
                mode="default"
                style={{ height: '250px', overflowY: 'hidden' }}
              />
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DailyLogs;
