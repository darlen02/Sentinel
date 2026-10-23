import type { SystemMetrics } from '../types';
import { getStoredToken } from './api';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

type MetricsListener = (data: SystemMetrics, latencyMs: number) => void;
type StatusListener = (status: ConnectionStatus) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private metricsListeners: Set<MetricsListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimer: any = null;
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect: boolean = true;

  public connect(): void {
    const token = getStoredToken();
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');
    this.shouldReconnect = true;

    // Use current location host, support both ws and wss
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.setStatus('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const metrics: SystemMetrics = JSON.parse(event.data);
          const latencyMs = Math.max(0, Date.now() - metrics.timestamp);
          this.metricsListeners.forEach((listener) => listener(metrics, latencyMs));
        } catch (err) {
          console.error('Failed to parse websocket message:', err);
        }
      };

      this.socket.onclose = (event) => {
        this.setStatus('disconnected');
        this.socket = null;
        if (event.code === 4001 || event.code === 1008) {
          // Auth failure
          this.shouldReconnect = false;
          window.dispatchEvent(new Event('sentinel:unauthorized'));
          return;
        }
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        if (this.socket) {
          this.socket.close();
        }
      };
    } catch (err) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.connect();
      }
    }, 2000);
  }

  private setStatus(newStatus: ConnectionStatus): void {
    this.status = newStatus;
    this.statusListeners.forEach((listener) => listener(newStatus));
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onMetrics(listener: MetricsListener): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }
}

export const wsClient = new WebSocketClient();
