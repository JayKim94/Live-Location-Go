package main

import "log"

// Hub definition
type Hub struct {
	clients map[*Client]bool

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
		clients:    make(map[*Client]bool),
		isReady:    false,
		nextRole:   "Hunter",
	}
}

func (h *Hub) updateStatus() {
	if len(h.clients) == 2 {
		h.isReady = true
		h.nextRole = "Runner"
		log.Println("Game Starting...")
	} else {
		h.isReady = false
		h.nextRole = "Hunter"
	}
}

// Handles requests
func (h *Hub) run() {
	for {
		select {
		// Register client
		case client := <-h.register:
			h.clients[client] = true
			h.updateStatus()

			for c := range h.clients {
				// Broadcast current client with assigned role
				c.send <- Message{
					Request: "UserJoined",
					Data:    client.username + "," + h.nextRole,
				}
				// Broadcast whether game's ready
				c.send <- Message{
					Request: "ReadyCheck",
					Data:    h.isReady,
				}
			}
		// Unregister client
		case client := <-h.unregister:
			// Broadcast left user with user name
			for c := range h.clients {
				c.send <- Message{
					Request: "UserLeft",
					Data:    client.username,
				}
			}

			if _, found := h.clients[client]; found {
				delete(h.clients, client)
				close(client.send)
			}

			log.Printf("Client Disconnected: %v", client.username)
		// Broadcast
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}
