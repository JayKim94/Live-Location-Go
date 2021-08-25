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

	// Entry point
	http.Handle("/", fs)
	http.HandleFunc("/ws", func(writer http.ResponseWriter, req *http.Request) {
		serveWs(hub, writer, req)
	})

	err := http.ListenAndServe(*address, nil)
	log.Println("Listening on :3000...")

	if err != nil {
		log.Fatal("Error while listen and serve: ", err)
	}
}
