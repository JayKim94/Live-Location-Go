package main

import (
	"encoding/json"
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
	username string
	// ref to hub
	hub *Hub

	// current websocket connection
	conn *websocket.Conn

	// buffered channel for outbounding messages
	send chan Message

	// ref to Room
	room *Room
}

type Message struct {
	Data    interface{} `json:"data"`
	Request string      `json:"request"`
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	// Set up for reading
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongDelay))
	c.conn.SetPongHandler(func(appData string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongDelay))
		return nil
	})

	// Read message and handle request
	for {
		message := Message{}
		err := c.conn.ReadJSON(&message)

		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error while reading message %v", err)
			}
			break
		}

		handleRequest(c, message)
	}
}

func handleRequest(c *Client, m Message) {
	if m.Request == "Register" {
		clients := make([]string, 0, len(c.hub.clients))
		for client := range c.hub.clients {
			clients = append(clients, client.username)
		}

		data, _ := json.Marshal(clients)

		c.hub.broadcast <- Message{
			Request: "ReceiveUsersList",
			Data:    string(data),
		}
	} else {
		c.hub.broadcast <- m
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

			if err := c.conn.WriteJSON(message); err != nil {
				log.Println(err)
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
	upgrader.CheckOrigin = func(r *http.Request) bool { return true }

	username, ok := req.URL.Query()["username"]

	if !ok || len(username[0]) < 1 {
		log.Println("Url Param 'key' is missing")
		return
	}

	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Println(err)
		return
	}

	log.Println("Client Connected...")

	client := &Client{hub: hub, conn: conn, send: make(chan Message, 256), username: string(username[0])}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}