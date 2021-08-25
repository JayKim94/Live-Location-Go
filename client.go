package main

import (
	"bytes"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeDelay = 10 * time.Second

	pongDelay = 60 * time.Second

	pingPeriod = (pongDelay * 9) / 10

	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Client struct {
	// ref to hub
	hub *Hub

	// current websocket connection
	conn *websocket.Conn

	// buffered channel for outbounding messages
	send chan []byte

	// ref to Room
	room *Room
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongDelay))
	c.conn.SetPongHandler(func(appData string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongDelay))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()

		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error while reading message %v", err)
			}
			break
		}

		message = bytes.TrimSpace(bytes.Replace(message, []byte{'\n'}, []byte{' '}, -1))
		c.hub.broadcast <- message
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, success := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeDelay))

			if !success {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			writer, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}

			writer.Write(message)

			// Queue up the message to websocket
			n := len(c.send)
			for i := 0; i < n; i++ {
				writer.Write([]byte{'\n'})
				writer.Write(<-c.send)
			}

			if err := writer.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeDelay))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func serveWs(hub *Hub, writer http.ResponseWriter, req *http.Request) {
	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}
