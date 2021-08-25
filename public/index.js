window.onload = function () {
    var conn;
    if (window["WebSocket"]) {
        conn = new WebSocket("ws://" + document.location.host + "/ws");

        conn.onopen = function (evt) {
            console.log(conn);
            conn.send({
                type: "register"
            })
        }

        conn.onmessage = function (evt) {
            var message = evt.data.split('\n');
            console.log(message);
        }
    }
}