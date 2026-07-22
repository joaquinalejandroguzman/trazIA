import axios, { AxiosInstance } from 'axios'

// Lee la URL base del entorno; usa localhost:3001 como fallback
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Instancia configurada de axios para comunicarse con el backend de TrazIA
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
