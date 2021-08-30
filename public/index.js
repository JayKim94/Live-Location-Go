/* GLOBALS */
// WS
let conn,
    my_username,
    my_role,
    my_points,
    enemy_points,
    appReady;

// Views
let view_title,
    view_lobby,
    view_connect,
    view_field;

// Components
let form_connect,
    input_username,
    list_logs,
    text_status,
    text_name,
    text_score,
    button_close,
    text_role,
    modal,
    modal_title,
    modal_subtitle,
    modal_dynamic,
    modal_image,
    send_message;

/* HELPER FUNCTIONS */
const appendLog = (content) => {
    if (!conn || !list_logs) return;

    const pad = (n) => n < 10 ? '0' + n : n;
    let current = new Date()
    current = `${pad(current.getHours())}:${pad(current.getMinutes())}:${pad(current.getSeconds())}`
    list_logs.innerHTML += `<div class='log'># ${content} :: ${current}</div> `
    list_logs.scrollTop = list_logs.scrollHeight - list_logs.clientHeight;
}

const showLobby = () => {
    if (!conn || !text_status || !view_connect || !view_lobby) return;

    text_status.innerHTML = `Hello <span class='accent-text accent-animation'>${my_username}</span>, waiting for the runner to enter...`;
    view_connect.classList.add('hide');
    view_lobby.classList.remove('hide');
}

const showGame = () => {
    // if (!conn || !view_title || !view_field) return;

    view_title.classList.add('hide');
    view_field.classList.remove('hide');
}

const sendRandomCoordinates = () => {
    if (!conn) return;

    const randRow = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]
    const randCol = Math.floor(Math.random() * 4) + 1;
    conn.send(JSON.stringify({ request: 'ReceiveLocation', data: `${my_role},${randRow},${randCol}` }))
}

const switchRoles = () => {
    if (!conn) return;

    appReady = false;

    if (my_role === "Hunter") {
        conn.send(JSON.stringify({ request: 'ReceivePoints', data: `${my_username}` }))
    }

    modal_title.innerText = "Hunter caught the runner!"
    modal_subtitle.innerText = "Switing Roles..."

    my_role = my_role === "Hunter" ? "Runner" : "Hunter"
    text_role.innerHTML = `<span class='${my_role === 'Hunter' ? 'hunter-text' : 'runner-text'}'>- ${my_role} -</span>`

    modal_dynamic.innerHTML = `You are <span class='${my_role === "Hunter" ? "hunter-text" : "runner-text"}'>${my_role}</span>`
    modal_image.src = "assets/target.gif"
    modal.classList.add("is-active")

    appendLog(`You are now <span class='accent-text'>${my_role}</span>`);
    setTimeout(function () {
        modal.classList.remove("is-active")
        appReady = true;
    }, 3000);
}

/* INIT */
window.onload = function () {
    // Load all dom elements
    (function GetElements() {
        view_title = document.getElementById('title-overlay')
        view_lobby = document.getElementById('rooms')
        view_connect = document.getElementById('connect-container')
        view_field = document.getElementById('game-field')

        form_connect = document.getElementById('connect-form')
        input_username = document.getElementById('username-field')
        text_status = document.getElementById('show-status')
        text_role = document.getElementById('show-role')
        text_name = document.getElementById('show-name')
        text_score = document.getElementById('score-dynamic')
        list_logs = document.getElementById('list-logs')
        button_close = document.getElementById('close-button')
        modal = document.getElementById("modal-container")
        modal_dynamic = document.getElementById("modal-dynamic")
        modal_title = document.getElementById("modal-title")
        modal_subtitle = document.getElementById("modal-subtitle")
        modal_image = document.getElementById("modal-image")
        send_message = document.getElementById("send-message")
    })()

    // On 'Connect' button click
    form_connect.onsubmit = (evt) => {
        evt.preventDefault();
        if (input_username.value) {
            App(input_username.value)
        } else {
            text_status.innerHTML = `Please enter <span class='accent-text'>Your Name</span> to connect`;
        }
    }

    appReady = true;
    my_points = 0;
    enemy_points = 0;
}

/* CONNECT */
function App(username) {
    // On 'Close Connection' button click
    button_close.onclick = (evt) => {
        conn.close()
        window.location.reload()
    }

    // On 'Enter' in text box
    send_message.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const message = send_message.value;
            if (!message) return;

            send_message.value = ''
            conn.send(JSON.stringify({ request: 'ReceiveMessage', data: `${my_username},${message}` }))
        }
    })

    // Connect to WebSocket
    if (window["WebSocket"]) {
        my_username = username;
        text_name.innerHTML = `${my_username}`

        conn = new WebSocket("ws://" + document.location.host + `/ws?username=${username}/`)
        showLobby()

        conn.onopen = (evt) => {
            console.log("WebSocket connection opened: ", evt)
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
                    (function StartGame() {
                        const isReady = message.data
                        if (isReady) {
                            modal.classList.add("is-active")
                            modal_dynamic.innerHTML = `<span class='${my_role === "Hunter" ? "hunter-text" : "runner-text"}'>${my_role}</span>`

                            setTimeout(() => {
                                modal.classList.remove("is-active")
                                showGame()
                                sendRandomCoordinates()
                            }, 3000)
                        }
                    })()
                    break
                case "UserJoined":
                    (function LogUserJoined() {
                        const userData = message.data.split(',')
                        const userName = userData[0]
                        const userRole = userData[1]

                        if (userName === my_username) {
                            my_role = userRole
                            text_role.innerHTML = `<span class='${my_role === 'Hunter' ? 'hunter-text' : 'runner-text'}'>- ${my_role} -</span>`
                            appendLog("You joined the field");
                        } else {
                            appendLog(`<span class='accent-text'>${userName} (${userRole})</span> has joined the field`);
                        }
                    })()
                    break
                case "UserLeft":
                    (function CloseConnection() {
                        const username = message.data

                        appendLog(`<span class='accent-text'>${username}</span> has left the field`)
                        appendLog(`Closing connection...`)

                        modal.classList.add("is-active")
                        modal_title.innerText = "Connection Lost"
                        modal_subtitle.innerText = my_points > enemy_points ? "You Won!" : "Total Score"
                        modal_dynamic.innerHTML = `<span class="accent-text">${my_points}</span> : ${enemy_points}`
                        modal_image.src = "assets/puzzled.gif"

                        setTimeout(() => {
                            conn.close()
                            window.location.reload()
                        }, 2000)
                    })()
                    break
                case "ReceiveLocation":
                    (function UpdateLocation() {
                        const locationData = message.data.split(',')
                        const role = locationData[0]
                        const row = locationData[1]
                        const col = locationData[2]

                        if (role === 'Hunter') {
                            (function UpdateHunterLocation() {
                                const previousCell = document.getElementsByClassName('hunter-location')[0];

                                if (previousCell) {
                                    previousCell.innerHTML = ''
                                    previousCell.classList.remove('hunter-location')
                                }

                                const targetCell = document.getElementById(`${row}${col}`)

                                if (targetCell.classList.contains('runner-location')) {
                                    switchRoles()
                                    targetCell.classList.remove('runner-location')
                                    targetCell.innerHTML = ''
                                } else {
                                    targetCell.classList.add('hunter-location')
                                    targetCell.innerHTML = `<div class="hunter">Hunter ${my_role === role ? "(You)" : ""}</div>`
                                }
                            })()
                        } else {
                            (function UpdateRunnerLocation() {
                                const previousCell = document.getElementsByClassName('runner-location')[0];

                                if (previousCell) {
                                    previousCell.innerHTML = ''
                                    previousCell.classList.remove('runner-location')
                                }

                                const targetCell = document.getElementById(`${row}${col}`)

                                if (targetCell.classList.contains('hunter-location')) {
                                    switchRoles()
                                    targetCell.classList.remove('hunter-location')
                                    targetCell.innerHTML = ''
                                } else {
                                    targetCell.classList.add('runner-location')
                                    targetCell.innerHTML = `<div class="runner">Runner ${my_role === role ? "(You)" : ""}</div>`
                                }
                            })()
                        }

                        appendLog(`<span class='${role == "Hunter" ? "hunter-text" : "runner-text"}'>${role}</span> moved to the coordinates <span class='accent-text'>\"${row}${col}\"</span>`);
                    })()
                    break
                case "SendLocation":
                    if (appReady) {
                        sendRandomCoordinates()
                    }
                    break
                case "ReceivePoints":
                    (function UpdatePoints() {
                        const userName = message.data;

                        if (userName === my_username) {
                            my_points++
                            text_score.innerText = my_points
                        } else {
                            enemy_points++
                        }
                    })()
                case "ReceiveMessage":
                    (function LogMessage() {
                        const data = message.data.split(',')
                        const userName = data[0]
                        const content = data[1]

                        appendLog(`<span class='accent-text'>${userName}</span>: ${content}`);
                    })()
                default:
                    break
            }
        }
    }
}



