package main

import (
	"flag"
	"log"
	"net/http"
)

var address = flag.String("localhost", ":8080", "http service address")

func main() {
	flag.Parse()
	hub := newHub()
	go hub.run()

	fs := http.FileServer(http.Dir("./public"))

	// Routes
	http.Handle("/", fs)
	http.HandleFunc("/ws", func(writer http.ResponseWriter, req *http.Request) {
		serveWebSocket(hub, writer, req)
	})

	// Serve
	log.Println("Listening on http://localhost:8080...")
	err := http.ListenAndServe(*address, nil)

	if err != nil {
		log.Fatal("Error while listen and serve: ", err)
	}
}
