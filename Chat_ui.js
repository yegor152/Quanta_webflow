//insert problem ids here:
let ids = [1,2,3,4,5]
const serverLink = 'https://api.quanta.world/';
let chat = null;
let problems = {};
let user_id = null;
let is_user_verified = false;

//run this code once, copy problem ids from console, insert them to code, and comment following lines of code afterwards
/*
function getIDS(){
    document.addEventListener('DOMContentLoaded', () => {
    let containers = document.getElementsByClassName('insert-problem');
    if(containers.length == 0){
        return;
    }
    let ids = [];
    for(let i = 0; i < containers.length; i++) {
        let container = containers[i];
        let id = container.getAttribute("data-id")
        if (!id) {
            containers[i].innerHTML = "No problem id reference :(";
            continue;
        }
        ids.push(id);
    }
    console.log(ids)
    })
}
getIDS()
 */

const dataPromise = fetch(serverLink + 'getProblems', {
    method: 'POST',
    body: JSON.stringify({ids: ids}),
    headers: {'Content-Type': 'application/json'},
}).then(response => {
    if (!response.ok) {
        console.error(`HTTPS error! status: ${response.status}`);
        return null
    }
    return response.json();
}).catch(error => {
    console.error(error);
})

document.addEventListener('DOMContentLoaded', async () => {
    const data = await dataPromise
    if(!data) return
    let currentProblem = 1
    for(let i = 0; i < data.length; i++) {
        const problem = data[i]
        const container = document.querySelector(`[data-id="${problem.id}"]`);
        if(!container) {
            console.error(`Container with data-id ${problem.id} not found`);
            continue
        }

        problems[problem.id] = {
            number: currentProblem,
            statement: problem.problem_statement,
        };
        //TODO check problem number by div posision
        container.innerHTML = `
                <p class="edu-problem-name-and-num">Problem ${currentProblem}.</p>
                <a class="submit-solution w-button" data-id="${problem.id}">Submit Solution</a>
                <p class="edu-p">${problem.problem_statement}</p>
                `
        container.querySelector(".submit-solution").addEventListener('click', openChat)
        currentProblem ++
        MathJax.typeset([container])
    }
    window.$memberstackDom.getCurrentMember().then(response => {
        if(response){
            user_id = response.data.id
            is_user_verified = response.data.verified
        }
    })
})


function openChat(ev){
    let id = ev.target.getAttribute("data-id");
    if(!problems[id]){
        console.error('Something went wrong');
        return;
    }
    if(!chat) {
        chatWindow = document.createElement("div");
        chatWindow.id = "chatWindow";
        chatWindow.innerHTML = `
    <span class="close-chat-btn" onclick="closeWindow(event)">✖</span>
              
    <div id="inputDiv" class="chat-screen">
        <h6 id="submitHeader">Submit your solution to problem ${problems[id].number}:</h6>
        <textarea id="solution-input" onkeydown="handleKeydown(event)" placeholder="Submit your solution..."></textarea>
        <button id="submit-btn" class="btn" onclick="sendSolution(event)">Send</button>
    </div>

    <!-- Loading Screen -->
    <div id="loadingDiv" class="chat-screen">
        <p>Grading your submission...</p>
    </div>

    <!-- Result Screen -->
    <div id="responseDIV" class="chat-screen">
        <div class="grade-row">
            <h4>Grade on Correctness:</h4>
            <h4 id="grade-correctness-value"></h4>
        </div>
        <div id="feedback-correctness">
            <h4>Feedback on Correctness:</h4>
            <p id="feedback-correctness-value"></p>
        </div>
        <div class="grade-row">
            <h4>Grade on Quality:</h4>
            <h4 id="grade-quality-value"></h4>
        </div>
        <div id="feedback-quality">
            <h4>Feedback on Quality:</h4>
            <p id="feedback-quality-value"></p>
        </div>
        <div id="feedback-buttons">
            <button id="thumb-up-btn" onclick="sendFeedback(event, true)" class="btn">👍</button>
            <button id="thumb-down-btn" onclick="sendFeedback(event, false)" class="btn">👎</button>
        </div>
    </div>

    <!-- Error Screen -->
    <div id="errorDiv" class="chat-screen">
        <p id="error-message"></p>
        <button id="error-close-btn" onclick="closeWindow(event)" class="btn">Close</button>
    </div>
    `;
        document.body.appendChild(chatWindow);
        chat = {
            window: chatWindow,
            input: chatWindow.querySelector("#solution-input"),
            loadingDiv: chatWindow.querySelector("#loadingDiv"),
            responseDIV: chatWindow.querySelector("#responseDIV"),
            inputDiv: chatWindow.querySelector("#inputDiv"),
            submitHeader: chatWindow.querySelector("#submitHeader"),
            errorDiv: chatWindow.querySelector("#errorDiv"),
            errorP: chatWindow.querySelector("#error-message"),
            FC: chatWindow.querySelector("#feedback-correctness-value"),
            GC: chatWindow.querySelector("#grade-correctness-value"),
            GQ: chatWindow.querySelector("#grade-quality-value"),
            FQ: chatWindow.querySelector("#feedback-quality-value"),
            problemID: id,
            status: "input"
        }
        showChatPage("inputDiv")
    }
    else{
        if(!is_user_verified){
            showError("Only registered, and verfied users can send solutions. Login and verify your email to continue")
            return;
        }
        if(chat.status == "fetching") chat.controller.abort()
        chat.submitHeader.innerHTML = `Submit your solution to problem ${problems[id].number}:`;
        showChatPage("inputDiv");
        chat.problemID = id;
        chat.status = "input";
    }
}

function closeWindow(ev){
    if(chat.status == "fetching") chat.controller.abort()
    chat.problemID = null;
    chat.window.style.display = "none";
    chat.status = "closed";
}

function showChatPage(pageID){
    if(!chat){
        console.error("No chat found")
        return
    }

    chat.window.style.display = 'block';
    chat.window.querySelectorAll('.chat-screen').forEach(screen => {
        screen.style.display = 'none';
    });

    for(let id of ['thumb-up-btn', 'thumb-down-btn']){
        let el = document.getElementById("thumb-up-btn")
        el.classList.remove("pressed");
        el.removeAttribute("disabled")
    }
    chat.window.querySelector(`#${pageID}`).style.display = 'block';
}

function showError(msg){
    showChatPage("errorDiv");
    chat.errorP.innerHTML = msg;
}

function sendSolution(ev){
    const solution = chat.input.value.trim();
    if(!solution)
        return
    if(!chat.problemID){
        console.error('Something went wrong')
        return
    }
    chat.input.value = "";
    showChatPage("loadingDiv")
    chat.status = "fetching";
    chat.controller = new AbortController();
    fetch(serverLink + 'generateResponse', {
        method: 'POST',
        body: JSON.stringify({problem_id: chat.problemID, student_solution: solution, user_id: user_id}),
        headers: {'Content-Type': 'application/json'},
        signal: chat.controller.signal
    })
        .then(response => {
            chat.status = "checked";
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                chat.status = "error";
                if(response.status == 401){
                    showError("Only registered, and verfied users can send solutions. Login and verify your email to continue")
                }
                else {
                    showError("Ooops sometging went wrong:(");
                }

            }
            return response.json();
        })
        .then(data => {
                if(!data.response) return
                showChatPage("responseDIV");
                chat.FQ.innerHTML = data.response["**Feedback on Quality**"];
                chat.FC.innerHTML = data.response["**Feedback on Correctness**"];
                chat.GQ.innerHTML = data.response["**Quality Grade**"];
                chat.GC.innerHTML = data.response["**Correctness Grade**"];
                chat.responseID = data.submission_id;
            }
        )
        .catch(error => {
            if(chat.controller.signal.aborted) return
            chat.status = "error";
            showError("Ooops sometging went wrong:(");
            console.error('Error fetching data:', error)
        });
}

function sendFeedback(ev, liked){
    ev.target.classList.add("pressed")
    document.getElementById("thumb-up-btn").setAttribute("disabled", true)
    document.getElementById("thumb-down-btn").setAttribute("disabled", true)
    fetch(serverLink + 'submitFeedback', {
        method: 'POST',
        body: JSON.stringify({memberstack_user_id: user_id, submission_id: chat.responseID, liked_by_user: liked}),
        headers: {'Content-Type': 'application/json'},
    })
        .then(response => {
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return response.json();
            }
            return response.json();
        })
        .then(data => {
                console.log(`Saved: ${data.saved}`);
            }
        )
        .catch(error => {
            console.error('Error fetching data:', error)
        });
}

function handleKeydown(event){
    if (event.key === 'Enter' && !event.shiftKey) {
        sendSolution();
    }
}


