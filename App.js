const express = require("express");
const multer  = require("multer");
const bodyParser = require("body-parser");

const app = express();
app.locals.moment = require('moment');
const moment = require('moment');

const fs = require('fs');

const urlencodedParser = bodyParser.urlencoded({extended: false});

app.set("view engine", "pug");

let state;

const viewStyles = ["pageGridView", "pageListView"];
let containersView = 0;

if (fs.existsSync('data.json')) {
    const data = fs.readFileSync('data.json').toString();
    state = JSON.parse(data);
    state.containers
        .forEach(container => container.tasks
            .forEach(task => task.expires = new Date(task.expires)));
    console.log(state);
} else {
    state = {
        containers: [],
        containerId: 0,
        taskId: 0
    };
}

let lastFile;

class Container {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.tasks = [];
        this.isShowingComplete = true;
    }
}

class Task {
    constructor(id, name, expires, description, file) {
        this.id = id;
        this.name = name;
        this.expires = expires;
        this.description = description;
        this.isComplete = false;
        this.file = file;
    }
}

app.use(express.static(__dirname));
app.use(multer({dest:"uploads"}).single("task-files"));

app.get("/", function(request, response){
    response.render("pageGridView", {containers: state.containers});
});

app.get("/download/:taskId/:filename", function(request, response) {
    let path = process.cwd() + "\\uploads\\" + request.params["filename"];
    let taskId = request.params["taskId"];
    let originalName = state.containers
        .filter(container => container.tasks.filter(task => task.id === parseInt(taskId)).length > 0)[0]
        .tasks.filter(task => task.id === parseInt(taskId))[0].file.originalname;
    response.download(path, originalName);
});

app.post("/", function (request, response, next) {
    console.log(request.file);
    lastFile = request.file;
    next();
})

app.post("/", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);
    console.log(request.body);
    if (request.body.add) {
        ++state.containerId;
        state.containers.push(new Container(state.containerId, `Group-${state.containerId}`));
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["edit-container"]) {
        let container = state.containers.filter(value => value.id === parseInt(request.body["edit-container"], 10))[0]; //check if no elem found
        container.name = request.body["container-name"];
        container.isShowingComplete = request.body["paper-switch"] === "on";
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["delete-container"]) {
        state.containers = state.containers.filter(value => value.id !== parseInt(request.body["delete-container"], 10));
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["add-task"]) {
        ++state.taskId;
        if (!request.body["task-name"]) {
            request.body["task-name"] = `Task-${state.taskId}`;
        }
        if (!request.body["task-expires"]) {
            request.body["task-expires"] = moment(new Date()).add(1, 'days');
        }
        state.containers
            .filter(value => value.id === parseInt(request.body["add-task"]))[0].tasks
            .push(new Task(state.taskId, request.body["task-name"], new Date(request.body["task-expires"]), request.body["task-description"], lastFile));
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["edit-task"]) {
        let [containerId, taskId] = request.body["edit-task"].split("-");
        let container = state.containers.filter(value => value.id === parseInt(containerId))[0];
        let task = container.tasks.filter(value => value.id === parseInt(taskId))[0];
        task.name = request.body["task-name"];
        task.expires = new Date(request.body["task-expires"]);
        task.description = request.body["task-description"];
        task.isComplete = request.body["paper-switch"] === "on";
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["delete-task"]) {
        let [containerId, taskId] = request.body["delete-task"].split("-");
        let container = state.containers.filter(value => value.id === parseInt(containerId))[0];
        container.tasks = container.tasks.filter(value => value.id !== parseInt(taskId));
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["move-task"]) {
        let [containerId, taskId] = request.body["move-task"].split("-");
        let container = state.containers.filter(value => value.id === parseInt(containerId))[0];
        let task = container.tasks.filter(value => value.id === parseInt(taskId))[0];
        container.tasks = container.tasks.filter(value => value.id !== parseInt(taskId));
        container = state.containers.filter(value => value.id === parseInt(request.body["container"]))[0];
        container.tasks.push(task);
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync("data.json", data);
        response.render("pageGridView", {containers: state.containers});
    } else if (request.body["grid-view"]) {
        if (containersView === 1) {
            response.render(viewStyles[0], {containers: state.containers});
            containersView = 0;
        }
    } else if (request.body["list-view"]) {
        if (containersView === 0) {
            response.render(viewStyles[1], {containers: state.containers});
            containersView = 1;
        }
    } else {
        response.sendStatus(404);
    }
})

app.get("/*", function (request, response) {
    response.sendStatus(404);
});

app.listen(3000);