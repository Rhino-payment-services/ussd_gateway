import axios from "axios";
import { API_BASE } from "./config";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: API_BASE || undefined,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
