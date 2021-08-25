package main

// Hub definition
type Hub struct {
	clients map[*Client]bool

	broadcast chan Message

	register chan *Client

	unregister chan *Client
}

// Initializes hub
func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Handles requests
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			for client := range h.clients {
				select {
				case client.send <- Message{
					Request: "UserLeft",
					Data:    client.username,
				}:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}

			if _, found := h.clients[client]; found {
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
