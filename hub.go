package main

type Room struct {
	id    string
	title string
}

// Hub definition
type Hub struct {
	clients map[*Client]bool

	broadcast chan Message

	register chan *Client

	unregister chan *Client

	rooms map[*Room]map[*Client]bool
}

// Initializes hub
func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		rooms:      make(map[*Room]map[*Client]bool),
	}
}

// Handles requests
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, success := h.clients[client]; success {
				delete(h.clients, client)
				close(client.send)
			}
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
