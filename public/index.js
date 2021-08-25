let conn,
    my_username,
    my_role;

let view_title,
    view_lobby,
    view_connect,
    view_field;

let form_connect,
    input_username,
    list_logs,
    text_status,
    text_name,
    text_role;

window.onload = function () {
    view_title = document.getElementById('title-overlay')
    view_lobby = document.getElementById('rooms')
    view_connect = document.getElementById('connect-container')
    view_field = document.getElementById('game-field')

    form_connect = document.getElementById('connect-form')
    input_username = document.getElementById('username-field')
    text_status = document.getElementById('show-status')
    text_role = document.getElementById('show-role')
    text_name = document.getElementById('show-name')
    list_logs = document.getElementById('list-logs')

    form_connect.onsubmit = function (evt) {
        evt.preventDefault();

        if (input_username.value) {
            openConnection(input_username.value)
        } else {
            text_status.innerHTML = `Please enter <span class='accent-text'>Your Name</span> to connect`;
        }
    }
}

function openConnection(username) {
    if (window["WebSocket"]) {
        my_username = username;
        text_name.innerHTML = `${my_username}`

        conn = new WebSocket("ws://" + document.location.host + `/ws?username=${username}`);
        toggleLobby();
        text_status.innerHTML = `Hello <span class='accent-text'>${username}</span>, waiting for the runner to enter...`;

        conn.onopen = function (evt) {
            console.log("WebSocket connection opened: ", evt)
            conn.send(JSON.stringify({ request: "Register" }))
        }

        conn.onclose = function (evt) {
            console.log("WebSocket connection closed: ", evt)
        }

        conn.onerror = function (err) {
            console.warn("Error while connecting to WebSocket: ", err)
        }

        conn.onmessage = function (evt) {
            var message = JSON.parse(evt.data);
            console.log(message)

            if (message.request === 'ReadyCheck') {
                const isReady = message.data;
                if (isReady) {
                    toggleField();
                    sendRandomCoordinates();
                }
            } else if (message.request === 'UserJoined') {
                const userData = message.data.split(',')
                const userName = userData[0]
                const userRole = userData[1]

                if (userName === my_username) {
                    my_role = userRole
                    text_role.innerHTML = `${my_role}`
                    appendLog("You joined the field");
                } else {
                    appendLog(`<span class='accent-text'>${userName} (${userRole})</span> has joined the field`);
                }
            } else if (message.request === 'SendLocation') {
                sendRandomCoordinates();
            } else if (message.request === 'ReceiveLocation') {
                const locationData = message.data.split(',')
                const role = locationData[0]
                const row = locationData[1]
                const col = locationData[2]

                if (role === 'Hunter') {
                    const previousCell = document.getElementsByClassName('hunter-location')[0];

                    if (previousCell) {
                        previousCell.innerHTML = ''
                        previousCell.classList.remove('hunter-location')
                    }

                    const targetCell = document.getElementById(`${row}${col}`)
                    targetCell.classList.add('hunter-location')
                    targetCell.innerHTML = `<div class="hunter">Hunter</div>`

                } else {
                    const previousCell = document.getElementsByClassName('runner-location')[0];

                    if (previousCell) {
                        previousCell.innerHTML = ''
                        previousCell.classList.remove('runner-location')
                    }

                    const targetCell = document.getElementById(`${row}${col}`)
                    targetCell.classList.add('runner-location')
                    targetCell.innerHTML = `<div class="runner">Runner</div>`
                }

                appendLog(`${role} moved to the coordinates <span class='accent-text'>\"${row}${col}\"</span>`);
            }
        }
    }
}

function sendRandomCoordinates() {
    const randRow = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]
    const randCol = Math.floor(Math.random() * 4) + 1;
    conn.send(JSON.stringify({ request: 'ReceiveLocation', data: `${my_role},${randRow},${randCol}` }))
}

function appendLog(content) {
    let current = new Date()
    current = `${current.getHours()}:${pad(current.getMinutes())}:${current.getSeconds()}`
    list_logs.innerHTML += `<div class='log'># ${content} :: ${current}</div> `
    list_logs.scrollTop = list_logs.scrollHeight - list_logs.clientHeight;
}

function pad(n) {
    return n < 10 ? '0' + n : n;
}

function toggleField(show = true) {
    if (show) {
        view_title.classList.add('hide');
        view_field.classList.remove('hide');
    } else {
        view_field.classList.add('hide');
        view_title.classList.remove('hide');
    }
}

function toggleLobby(show = true) {
    if (show) {
        view_connect.classList.add('hide');
        view_lobby.classList.remove('hide');
    } else {
        view_lobby.classList.add('hide');
        view_connect.classList.remove('hide');
    }
}

