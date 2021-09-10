package main

import "log"

// Hub definition
type Hub struct {
	hunter *Client

	runner *Client

	broadcast chan Message

	register chan *Client

	unregister chan *Client

	isReady bool

	nextRole string
}

// Initializes hub
func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		hunter:     nil,
		runner:     nil,
		isReady:    false,
	}
}

func (h *Hub) updateStatus(c *Client) {
	if h.hunter == nil {
		h.hunter = c
		c.role = "Hunter"
		log.Println(c.username + " is now a hunter")
	} else {
		h.runner = c
		c.role = "Runner"
		log.Println(c.username + " is now a runner")
	}

	if h.hunter != nil && h.runner != nil {
		h.isReady = true
		log.Println("Game is ready")
	} else {
		h.isReady = false
	}
}

// Handles requests
func (h *Hub) run() {
	for {
		select {
		// Register client
		case client := <-h.register:
			h.updateStatus(client)

			msgUserJoined := Message{
				Request: "UserJoined",
				Data:    client.username + "," + client.role,
			}

			msgReadyCheck := Message{
				Request: "ReadyCheck",
				Data:    h.isReady,
			}

			if h.hunter != nil {
				h.hunter.send <- msgUserJoined
				h.hunter.send <- msgReadyCheck
			}

			if h.runner != nil {
				h.runner.send <- msgUserJoined
				h.runner.send <- msgReadyCheck
			}
		// Unregister client
		case client := <-h.unregister:
			msgUserLeft := Message{
				Request: "UserLeft",
				Data:    client.username,
			}

			if client.role == "Hunter" {
				// Clear hunter role and notify runner
				h.hunter = nil

				if h.runner != nil {
					h.runner.send <- msgUserLeft
				}

				close(client.send)
			} else if client.role == "Runner" {
				// Clear runner role and notify hunter
				h.runner = nil

				if h.hunter != nil {
					h.hunter.send <- msgUserLeft
				}

				close(client.send)
			}

			h.isReady = false

			log.Println(client.role + "(" + client.username + ") disconnected")
		// Broadcast
		case message := <-h.broadcast:
			if h.hunter != nil {
				h.hunter.send <- message
			}
			if h.runner != nil {
				h.runner.send <- message
			}
		}
	}
}
