package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"sentinel/internal/models"
)

type Client struct {
	httpClient *http.Client
	socketPath string
	isUnix     bool
}

func NewClient() *Client {
	socketPath := os.Getenv("DOCKER_SOCKET")
	if socketPath == "" {
		socketPath = "/var/run/docker.sock"
	}

	isUnix := true
	if strings.HasPrefix(socketPath, "unix://") {
		socketPath = strings.TrimPrefix(socketPath, "unix://")
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return net.DialTimeout("unix", socketPath, 2*time.Second)
		},
		DisableKeepAlives: true,
	}

	return &Client{
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   3 * time.Second,
		},
		socketPath: socketPath,
		isUnix:     isUnix,
	}
}

// Docker daemon container representation
type rawDockerPort struct {
	IP          string `json:"IP"`
	PrivatePort uint16 `json:"PrivatePort"`
	PublicPort  uint16 `json:"PublicPort"`
	Type        string `json:"Type"`
}

type rawDockerContainer struct {
	ID      string          `json:"Id"`
	Names   []string        `json:"Names"`
	Image   string          `json:"Image"`
	ImageID string          `json:"ImageID"`
	Command string          `json:"Command"`
	Created int64           `json:"Created"`
	State   string          `json:"State"`
	Status  string          `json:"Status"`
	Ports   []rawDockerPort `json:"Ports"`
}

func (c *Client) GetSummary() models.DockerSummary {
	summary := models.DockerSummary{
		Available:  false,
		Containers: []models.DockerContainer{},
	}

	// Verify socket path exists if unix
	if c.isUnix {
		if _, err := os.Stat(c.socketPath); err != nil {
			summary.Error = fmt.Sprintf("Docker socket (%s) bulunamadı. Ubuntu sunucuda /var/run/docker.sock bağlandığında otomatik aktif olur.", c.socketPath)
			return summary
		}
	}

	req, err := http.NewRequest("GET", "http://localhost/containers/json?all=1", nil)
	if err != nil {
		summary.Error = err.Error()
		return summary
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		summary.Error = fmt.Sprintf("Docker daemon ile iletişim kurulamadı: %v", err)
		return summary
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		summary.Error = fmt.Sprintf("Docker API Hatası (%d): %s", resp.StatusCode, string(body))
		return summary
	}

	var rawList []rawDockerContainer
	if err := json.NewDecoder(resp.Body).Decode(&rawList); err != nil {
		summary.Error = fmt.Sprintf("Docker yanıtı çözümlenemedi: %v", err)
		return summary
	}

	summary.Available = true
	summary.ContainersCount = len(rawList)

	for _, raw := range rawList {
		ports := make([]models.DockerPort, 0, len(raw.Ports))
		for _, p := range raw.Ports {
			ports = append(ports, models.DockerPort{
				IP:          p.IP,
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
			})
		}

		state := strings.ToLower(raw.State)
		switch state {
		case "running":
			summary.RunningCount++
		case "paused":
			summary.PausedCount++
		default:
			summary.StoppedCount++
		}

		// Clean container name (strip leading slash)
		cleanNames := make([]string, 0, len(raw.Names))
		for _, n := range raw.Names {
			cleanNames = append(cleanNames, strings.TrimPrefix(n, "/"))
		}

		idShort := raw.ID
		if len(idShort) > 12 {
			idShort = idShort[:12]
		}

		summary.Containers = append(summary.Containers, models.DockerContainer{
			ID:      idShort,
			Names:   cleanNames,
			Image:   raw.Image,
			ImageID: raw.ImageID,
			Command: raw.Command,
			Created: raw.Created,
			State:   state,
			Status:  raw.Status,
			Ports:   ports,
		})
	}

	return summary
}

func (c *Client) RestartContainer(id string) error {
	url := fmt.Sprintf("http://localhost/containers/%s/restart?t=5", id)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Docker restart failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *Client) StopContainer(id string) error {
	url := fmt.Sprintf("http://localhost/containers/%s/stop?t=5", id)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Docker stop failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *Client) StartContainer(id string) error {
	url := fmt.Sprintf("http://localhost/containers/%s/start", id)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Docker start failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}
