package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeDelay = 10 * time.Second

	pongDelay = 15 * time.Second

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

		isReady := false
		role := ""

		if len(c.hub.clients) > 1 {
			isReady = true
			role = "Runner"
		} else {
			role = "Hunter"
		}

		c.hub.broadcast <- Message{
			Request: "UserJoined",
			Data:    c.username + "," + role,
		}

		c.hub.broadcast <- Message{
			Request: "ReadyCheck",
			Data:    isReady,
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

			if len(c.hub.clients) == 2 {
				if err := c.conn.WriteJSON(Message{Request: "SendLocation"}); err != nil {
					log.Println(err)
				}
			}

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
		log.Println("Url parameter 'username' is missing")
		return
	}

	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Println(err)
		return
	}

	log.Println("Client Connected: " + username[0])

	client := &Client{hub: hub, conn: conn, send: make(chan Message, 256), username: string(username[0])}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}
