package main

import (
	"flag"
	"log"
	"net/http"
)

var address = flag.String("localhost", ":8080", "http service address")

func serveHome(w http.ResponseWriter, r *http.Request) {
	log.Println(r.URL)

	// 404
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	// READ-ONLY
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	http.ServeFile(w, r, "public/index.html")
}

func main() {
	flag.Parse()
	hub := newHub()
	go hub.run()

	// Entry point
	http.HandleFunc("/", serveHome)
	http.HandleFunc("/ws", func(writer http.ResponseWriter, req *http.Request) {
		serveWs(hub, writer, req)
	})

	err := http.ListenAndServe(*address, nil)

	if err != nil {
		log.Fatal("Error while listen and serve: ", err)
	}
}
