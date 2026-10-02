import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const receiverApi = axios.create({ baseURL: BASE_URL })

export const receiverLogin = (receiver_id, pin) =>
  receiverApi.post('/receivers/login', { receiver_id: Number(receiver_id), pin }).then((r) => r.data)

function receiverRequest(method, path, payload) {
  const token = sessionStorage.getItem('mcet_receiver_token')
  if (!token) throw new Error('Receiver session is missing. Please sign in again.')
  return receiverApi.request({
    method,
    url: path,
    data: payload,
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.data)
}

export const getReceiver = () => receiverRequest('get', '/receivers/me')
export const receiverHeartbeat = () => receiverRequest('post', '/receivers/heartbeat')
export const reportBluetoothDetection = (visitor_id) =>
  receiverRequest('post', '/receivers/bluetooth-detections', { visitor_id })
