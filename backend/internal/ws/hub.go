package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"sentinel/internal/metrics"
	"sentinel/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for dashboard connections
		return true
	},
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	collector  *metrics.Collector
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	lastData   *models.SystemMetrics
}

func NewHub(collector *metrics.Collector) *Hub {
	return &Hub{
		collector:  collector,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 100),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	// Background ticker for periodic host metric streaming
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()

	go func() {
		for range ticker.C {
			h.mu.RLock()
			clientCount := len(h.clients)
			h.mu.RUnlock()

			// Only poll metrics if at least one client is connected, to save CPU
			if clientCount > 0 {
				m, err := h.collector.Collect()
				if err != nil {
					log.Printf("Error collecting metrics: %v", err)
					continue
				}

				h.mu.Lock()
				h.lastData = m
				h.mu.Unlock()

				payload, err := json.Marshal(m)
				if err == nil {
					h.broadcast <- payload
				}
			}
		}
	}()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			cached := h.lastData
			h.mu.Unlock()

			// Send immediate snapshot on connect if available
			if cached != nil {
				if payload, err := json.Marshal(cached); err == nil {
					select {
					case client.send <- payload:
					default:
					}
				}
			} else {
				// Immediate first collect
				go func(c *Client) {
					if m, err := h.collector.Collect(); err == nil {
						if payload, err := json.Marshal(m); err == nil {
							select {
							case c.send <- payload:
							default:
							}
						}
					}
				}(client)
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Slow client dropped
					go func(c *Client) {
						h.unregister <- c
					}(client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to set websocket upgrade: %v", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) GetLatestSnapshot() (*models.SystemMetrics, error) {
	h.mu.RLock()
	data := h.lastData
	h.mu.RUnlock()

	if data != nil {
		return data, nil
	}
	return h.collector.Collect()
}
