/* GLOBALS */
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
    button_close,
    text_role;

/* HELPER FUNCTIONS */
const appendLog = (content) => {
    if (!list_logs) return;

    const pad = (n) => n < 10 ? '0' + n : n;
    let current = new Date()
    current = `${pad(current.getHours())}:${pad(current.getMinutes())}:${pad(current.getSeconds())}`
    list_logs.innerHTML += `<div class='log'># ${content} :: ${current}</div> `
    list_logs.scrollTop = list_logs.scrollHeight - list_logs.clientHeight;
}

const showLobby = () => {
    if (!text_status || !view_connect || !view_lobby) return;

    text_status.innerHTML = `Hello <span class='accent-text'>${my_username}</span>, waiting for the runner to enter...`;
    view_connect.classList.add('hide');
    view_lobby.classList.remove('hide');
}

const showGame = () => {
    if (!view_title || !view_field) return;

    view_title.classList.add('hide');
    view_field.classList.remove('hide');
}

const sendRandomCoordinates = () => {
    if (!conn) return;

    const randRow = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]
    const randCol = Math.floor(Math.random() * 4) + 1;
    conn.send(JSON.stringify({ request: 'ReceiveLocation', data: `${my_role},${randRow},${randCol}` }))
}

/* INIT */
window.onload = function () {
    // Load all dom elements
    (function getGlobalDom() {
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
        button_close = document.getElementById('close-button')
    })()

    // On 'Connect' button click
    form_connect.onsubmit = (evt) => {
        evt.preventDefault();

        if (input_username.value) {
            startApp(input_username.value)
        } else {
            text_status.innerHTML = `Please enter <span class='accent-text'>Your Name</span> to connect`;
        }
    }

    // On 'Close Connection' button click
    button_close.onclick = (evt) => {
        conn.close()
        window.location.reload()
    }
}

/* CONNECT */
function startApp(username) {
    // Connect to WebSocket
    if (window["WebSocket"]) {
        my_username = username;
        text_name.innerHTML = `${my_username}`

        conn = new WebSocket("ws://" + document.location.host + `/ws?username=${username}`)
        showLobby()

        conn.onopen = (evt) => {
            console.log("WebSocket connection opened: ", evt)
            // Request regislation => receives UserJoined message with assigned role
            conn.send(JSON.stringify({ request: "Register" }))
        }

        conn.onclose = (evt) => {
            console.log("WebSocket connection closed: ", evt)
        }

        conn.onerror = (err) => {
            console.warn("Error while connecting to WebSocket: ", err)
        }

        conn.onmessage = (msg) => {
            const message = JSON.parse(msg.data)

            // Handle requests
            switch (message.request) {
                case "ReadyCheck":
                    (function startGame() {
                        const isReady = message.data
                        if (isReady) {
                            showGame()
                            sendRandomCoordinates()
                        }
                    })()
                    break
                case "UserJoined":
                    (function logUserJoined() {
                        const userData = message.data.split(',')
                        const userName = userData[0]
                        const userRole = userData[1]

                        if (userName === my_username) {
                            my_role = userRole
                            text_role.innerHTML = `<span class='${my_role === 'Hunter' ? 'hunter-text' : 'runner-text'}'>- ${my_role} -</span>`
                            appendLog("You joined the field");
                        }
                        else {
                            appendLog(`<span class='accent-text'>${userName} (${userRole})</span> has joined the field`);
                        }
                    })()
                    break
                case "UserLeft":
                    (function closeConnection() {
                        const username = message.data
                        appendLog(`<span class='accent-text'>${username}</span> has left the field`)
                        appendLog(`Closing connection...`)
                        setTimeout(() => {
                            conn.close()
                            window.location.reload()
                        }, 2000)
                    })()
                    break
                case "ReceiveLocation":
                    (function updateLocation() {
                        const locationData = message.data.split(',')
                        const role = locationData[0]
                        const row = locationData[1]
                        const col = locationData[2]

                        if (role === 'Hunter') {
                            (function updateHunterLocation() {
                                const previousCell = document.getElementsByClassName('hunter-location')[0];

                                if (previousCell) {
                                    previousCell.innerHTML = ''
                                    previousCell.classList.remove('hunter-location')
                                }

                                const targetCell = document.getElementById(`${row}${col}`)
                                targetCell.classList.add('hunter-location')
                                targetCell.innerHTML = `<div class="hunter">Hunter ${my_role === role ? "(You)" : ""}</div>`
                            })()
                        } else {
                            (function updateRunnerLocation() {
                                const previousCell = document.getElementsByClassName('runner-location')[0];

                                if (previousCell) {
                                    previousCell.innerHTML = ''
                                    previousCell.classList.remove('runner-location')
                                }

                                const targetCell = document.getElementById(`${row}${col}`)
                                targetCell.classList.add('runner-location')
                                targetCell.innerHTML = `<div class="runner">Runner ${my_role === role ? "(You)" : ""}</div>`
                            })()
                        }

                        appendLog(`<span class='${role == "Hunter" ? "hunter-text" : "runner-text"}'>${role}</span> moved to the coordinates <span class='accent-text'>\"${row}${col}\"</span>`);
                    })()
                    break
                case "SendLocation":
                    sendRandomCoordinates()
                    break
                default:
                    break
            }
        }
    }
}



