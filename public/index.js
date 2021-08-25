window.onload = function () {
    var conn;
    if (window["WebSocket"]) {
        conn = new WebSocket("ws://" + document.location.host + "/ws");

        console.log(conn);
        conn.onmessage = function (evt) {
            var message = evt.data.split('\n');

            console.log(message);
        }
    }
}