window.onload = function () {
    var conn;
    var button = document.getElementById('create-button');

    if (window["WebSocket"]) {
        conn = new WebSocket("ws://" + document.location.host + "/ws?username=Jay");

        conn.onopen = function (evt) {
            console.log("WebSocket connection opened: ", evt)
            conn.send(JSON.stringify({ request: "Register", data: "Jay" }))
        }

        conn.onclose = function (evt) {
            console.log("WebSocket connection closed: ", evt)
        }

        conn.onerror = function (err) {
            console.warn("Error while connecting to WebSocket: ", err)
        }

        conn.onmessage = function (evt) {
            var message = JSON.parse(evt.data);

            if (message.request === 'ReceiveUsersList') {
                var names = JSON.parse(message.data)
                
                names.forEach(el => {
                    if (el != null) {
                        button.innerHTML = el;
                        console.log(el)
                    }
                });
            }
        }
    }
}