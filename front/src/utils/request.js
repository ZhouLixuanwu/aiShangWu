import axios from 'axios';
import { message } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code === 200 || res.code === 201) {
      return res;
    }
    message.error(res.message || '请求失败');
    return Promise.reject(new Error(res.message || '请求失败'));
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(new Error('登录已过期，请重新登录'));
      }
      
      if (status === 403) {
        message.error('没有权限执行此操作');
        return Promise.reject(new Error('没有权限'));
      }
      
      message.error(data?.message || '请求失败');
      return Promise.reject(new Error(data?.message || '请求失败'));
    }
    
    message.error('网络错误，请稍后重试');
    return Promise.reject(error);
  }
);

export default request;

