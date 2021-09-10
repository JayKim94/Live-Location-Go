/* GLOBALS */
// Websocket and game info
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

// DOM Components
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

const HIDE             = "hide"
const ACTIVE           = "is-active"
const IMG_DISCONNECTED = "assets/puzzled.gif"
const IMG_SWITCH_ROLES = "assets/target.gif"
const HUNTER           = "Hunter"
const RUNNER           = "Runner"
const HUNTER_LOCATION  = "hunter-location"
const RUNNER_LOCATION  = "runner-location"

/** SCRIPT **/
window.onload = function () {
    // Load document
    view_title      = document.getElementById('title-overlay')
    view_lobby      = document.getElementById('rooms')
    view_connect    = document.getElementById('connect-container')
    view_field      = document.getElementById('game-field')
    form_connect    = document.getElementById('connect-form')
    input_username  = document.getElementById('username-field')
    text_status     = document.getElementById('show-status')
    text_role       = document.getElementById('show-role')
    text_name       = document.getElementById('show-name')
    text_score      = document.getElementById('score-dynamic')
    list_logs       = document.getElementById('list-logs')
    button_close    = document.getElementById('close-button')
    modal           = document.getElementById("modal-container")
    modal_dynamic   = document.getElementById("modal-dynamic")
    modal_title     = document.getElementById("modal-title")
    modal_subtitle  = document.getElementById("modal-subtitle")
    modal_image     = document.getElementById("modal-image")
    send_message    = document.getElementById("send-message")
    
    // Init game states
    appReady        = true
    my_points       = 0
    enemy_points    = 0

    // On 'Connect' button click
    form_connect.onsubmit = (evt) => 
    {
        evt.preventDefault();
        const username = input_username.value

        if   (username) Game(username)
        else text_status.innerHTML = `Please enter <span class='accent-text'>Your Name</span> to connect`
    }
}

/* CONNECT */
function Game(username) {
    // On 'Close Connection' button click
    button_close.onclick = (evt) => { conn.close(); window.location.reload(); }

    // On 'Enter' in text box
    send_message.addEventListener('keypress', function (e) 
    {
        if (e.key === 'Enter') 
        {
            const message = send_message.value
            if (!message) return

            const request = "ReceiveMessage" 
            const data = my_username.concat(',', message)

            conn.send(JSON.stringify({ request, data }))
            send_message.value = ''
        }
    })

    // Connect to WebSocket
    if (window["WebSocket"]) {
        my_username = username
        text_name.innerHTML = username

        const address = "ws://".concat(document.location.host).concat("/ws");
        const queryParams = "?username=".concat(username);

        conn = new WebSocket(address.concat(queryParams));

        if (!conn || !text_status || !view_connect || !view_lobby) return;
        
        // Either wait for the runner or show game starting dialog
        text_status.innerHTML = `Hello <span class='accent-text accent-animation'>${my_username}</span>, 
            waiting for the runner to enter...`;
        view_connect.classList.add(HIDE);
        view_lobby.classList.remove(HIDE);

        conn.onopen    = (evt) => console.log("WebSocket connection opened: ", evt)
        conn.onclose   = (evt) => console.log("WebSocket connection closed: ", evt)
        conn.onerror   = (err) => console.warn("Error while connecting to WebSocket: ", err)

        // Handle requests
        conn.onmessage = (msg) => {
            const message = JSON.parse(msg.data)

            switch (message.request) 
            {
                case "ReadyCheck":
                    StartGame(message)
                    break
                case "UserJoined":
                    LogUserJoined(message)
                    break
                case "UserLeft":
                    CloseConnection(message)
                    break
                case "SendLocation":
                    SendRandomCoordinates()
                    break
                case "ReceiveLocation":
                    UpdateLocation(message)
                    break
                case "ReceivePoints":
                    UpdatePoints(message)
                    break
                case "ReceiveMessage":
                    LogMessage(message)
                    break
                default:
                    break
            }
        }
    }
}

/** HANDLERS **/

// Parses data containing ready state of the hub 
function StartGame(message) {
    const isReady = message.data;

    if (isReady) 
    {
        modal.classList.add(ACTIVE)
        modal_dynamic.innerHTML = `<span class='${my_role === HUNTER ? "hunter-text" : "runner-text"}'>${my_role}</span>`
        
        setTimeout(() => 
        {
            modal.classList.remove(ACTIVE)
            view_title.classList.add(HIDE);
            view_field.classList.remove(HIDE);
        }, 3000)
    }
}

// Parses and logs data containing username and message content
function LogMessage(message) {
    const data      = message.data.split(',')
    const userName  = data[0]
    const content   = data[1]
    
    appendLog(`<span class='accent-text'>[${userName}]</span>: ${content}`);
}

// Parses and logs data containing username and role of newly entered user
function LogUserJoined(message) {
    const userData = message.data.split(',')
    const userName = userData[0]
    const userRole = userData[1]

    if (userName === my_username) 
    {
        my_role             = userRole
        text_role.innerHTML = `<span class='${my_role === HUNTER ? 'hunter-text' : 'runner-text'}'>- ${my_role} -</span>`
        
        appendLog("You joined the field")
    } 
    else appendLog(`<span class='accent-text'>${userName} (${userRole})</span> has joined the field`)
}

// After 2 seconds, closes websocket connection and reloads the page to the initial state
function CloseConnection(message) {
    const username = message.data

    appendLog(`<span class='accent-text'>${username}</span> has left the field`)
    appendLog(`Closing connection...`)

    modal.classList.add(ACTIVE)
    modal_title.innerText       = "Connection Lost"
    modal_subtitle.innerText    = my_points > enemy_points ? "You Won!" : "Total Score"
    modal_dynamic.innerHTML     = `<span class="accent-text">${my_points}</span> : ${enemy_points}`
    modal_image.src             = IMG_DISCONNECTED

    setTimeout(() => { conn.close(); window.location.reload(); }, 2000)
}

// Parses and updates location data of either of roles
function UpdateLocation(message) {
    const locationData  = message.data.split(',')
    const role          = locationData[0]
    const row           = locationData[1]
    const col           = locationData[2]

    if (role === HUNTER) {
        (function updateHunterLocation() {
            // Reset previous hunter location
            const previousCell = document.getElementsByClassName(HUNTER_LOCATION)[0]

            if (previousCell) 
            {
                previousCell.innerHTML = ''
                previousCell.classList.remove(HUNTER_LOCATION)
            }

            const targetCell = document.getElementById(`${row}${col}`)

            if (targetCell.classList.contains(RUNNER_LOCATION)) 
            {
                switchRoles()
                targetCell.classList.remove(RUNNER_LOCATION)
                targetCell.innerHTML = ''
            } 
            else 
            {
                targetCell.classList.add(HUNTER_LOCATION)
                targetCell.innerHTML = `<div class="hunter">${HUNTER} ${my_role === role ? "(You)" : ""}</div>`
            }
        })()
    } 
    else 
    {
        (function updateRunnerLocation() {
            const previousCell = document.getElementsByClassName(RUNNER_LOCATION)[0]

            if (previousCell) 
            {
                previousCell.innerHTML = ''
                previousCell.classList.remove(RUNNER_LOCATION)
            }

            const targetCell = document.getElementById(`${row}${col}`)

            if (targetCell.classList.contains(HUNTER_LOCATION)) 
            {
                switchRoles()
                targetCell.classList.remove(HUNTER_LOCATION)
                targetCell.innerHTML = ''
            } 
            else 
            {
                targetCell.classList.add(RUNNER_LOCATION)
                targetCell.innerHTML = `<div class="runner">${RUNNER} ${my_role === role ? "(You)" : ""}</div>`
            }
        })()
    }

    appendLog(`<span class='${role == HUNTER ? "hunter-text" : "runner-text"}'>
        ${role}</span> moved to the coordinates <span class='accent-text'>\"
        ${row}${col}\"</span>`);
}

// Sends random coordinates of the current role
function SendRandomCoordinates() {
    if (!conn || !appReady) return;

    const randRow = ['A', 'B', 'C', 'D'][getRandomInt(4)];
    const randCol = ['1', '2', '3', '4'][getRandomInt(4)];
    
    const request = 'ReceiveLocation'
    const data    =  my_role.concat(',', randRow, ',', randCol)

    conn.send(JSON.stringify({ request, data }))
}

// Parses data containing winner and win point
function UpdatePoints(message) {
    const userName = message.data;

    if (userName === my_username) 
    {
        my_points++
        text_score.innerText = my_points
    } 
    else 
    {
        enemy_points++
    }
}

/** HELPER FUNCTIONS **/

// Pads left with 0
const pad       = (n) => n < 10 ? '0' + n : n

// Appends a new log line in the log box
const appendLog = (content) => {
    if (!conn || !list_logs) return;

    let current         = new Date()
    current             = `${pad(current.getHours())}:${pad(current.getMinutes())}:${pad(current.getSeconds())}`
    list_logs.innerHTML += `<div class='log'># ${content} :: ${current}</div>`
    // Auto scroll to bottom
    list_logs.scrollTop = list_logs.scrollHeight - list_logs.clientHeight;
}

// Generates a randomized integer
const getRandomInt = (max) => Math.floor(Math.random() * max)

// Switch roles between the hunter and the runner
const switchRoles = () => {
    if (!conn) return;

    appReady = false;

    if (my_role === HUNTER) 
    {
        const request = 'ReceivePoints'
        const data    = my_username

        conn.send(JSON.stringify({ request, data }))
    }

    modal_title.innerText       = `${HUNTER} caught the ${RUNNER}!`
    modal_subtitle.innerText    = "Switing Roles..."
    my_role                     = my_role === HUNTER ? RUNNER : HUNTER
    text_role.innerHTML         = `<span class='${my_role === HUNTER ? 'hunter-text' : 'runner-text'}'>- ${my_role} -</span>`
    modal_dynamic.innerHTML     = `You are <span class='${my_role === HUNTER ? "hunter-text" : "runner-text"}'>${my_role}</span>`
    modal_image.src             = IMG_SWITCH_ROLES
    modal.classList.add(ACTIVE)

    appendLog(`You are now <span class='accent-text'>${my_role}</span>`);
    setTimeout(function () { modal.classList.remove(ACTIVE); appReady = true; }, 3000);
}