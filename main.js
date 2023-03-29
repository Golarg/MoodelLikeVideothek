const express = require("express");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const Transform = require("stream").Transform;


const directory = "/Users/Steffen/Documents/NetBeansProjects/Moodle/";

const app = express();
app.use(fileUpload());

const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = 8000;

app.get("/", function (req, res) {
    res.sendFile(directory + "public/index.html");
});

app.post("/", function (req, res) {
    if(!req.files) {
        res.status(400).send("Es wurde keine Datei zum Hochladen ausgewählt.");
        res.end();
        return;
    }
    const uploadFile = req.files.UploadFile;
    
    const path = directory + "Videos/" + uploadFile.name;
    uploadFile.mv(path, (err) => {
        if (err) {
            return res.status(500).send(err);
        }
        fs.writeFile("./Chats/" + uploadFile.name.substring(0, uploadFile.name.length - 3) + "txt", "", function (err) {
            if (err) throw err;
        });
        res.sendFile(directory + "public/upload.html");
        return;
    });
});

app.get("/watch", function (req, res) {
    const replacementTransform = new Transform();
    replacementTransform._transform = function(data, encoding, done) {
        const str = data.toString().replace("/video", "/video?choice=" + req.query.choice);
        this.push(str);
        done();
    };

    res.write("<!-- Begin stream -->\n");
    let stream = fs.createReadStream("public/watch.html");
    stream.pipe(replacementTransform).on("end", () => {
        res.write("\n<!-- End stream -->");
    }).pipe(res);
});

app.get("/getVideoList", function (req, res) {
    var filenames = fs.readdirSync(directory + "Videos/");
    res.status(200).send(filenames);
});

app.get("/video", function (req, res) {
    const filename = directory + "Videos/" + req.query.choice;
    const range = req.headers.range;
    if (!range) {
        res.status(400).send("Requires Range header");
    }
    const videoPath = filename;
    const videoSize = fs.statSync(filename).size;
    
    const CHUNK_SIZE = 10 ** 6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4"
    };
    res.writeHead(206, headers);
    const videoStream = fs.createReadStream(videoPath, { start, end });
    videoStream.pipe(res);
});

app.get("/getChatMessages", function (req, res) {
    var chat = fs.readFileSync("./Chats/" + req.query.video, {encoding:"utf8", flag:"r"});
    chat = chat.split("\n");
    let time = parseInt(req.query.time);
    var h = Math.floor(time / 3600);
    var m = Math.floor((time / 60)) % 60;
    var s = time % 60;
    h = Math.floor(h/10) == 0 ? "0" + h : "" + h;
    m = Math.floor(m/10) == 0 ? "0" + m : "" + m;
    s = Math.floor(s/10) == 0 ? "0" + s : "" + s;
    const result = chat.filter(function(msg) { 
        return msg.startsWith(h + ":" + m + ":" + s);
    });
    res.status(200).send(result);
});

app.get("/getAllChatMessages", function (req, res) {
    var chat = fs.readFileSync("./Chats/" + req.query.video, {encoding:"utf8", flag:"r"});
    chat = chat.split("\n");
    var result = [];
    for(let i = 0; i < req.query.time; i++) {
        var h = Math.floor(i / 3600);
        var m = Math.floor((i / 60)) % 60;
        var s = i % 60;
        h = Math.floor(h/10) == 0 ? "0" + h : "" + h;
        m = Math.floor(m/10) == 0 ? "0" + m : "" + m;
        s = Math.floor(s/10) == 0 ? "0" + s : "" + s;
        for(let j = 0; j < chat.length; j++) {
            if(chat[j].includes(h + ":" + m + ":" + s))
                result.push(chat[j]);
        }   
    }
    res.status(200).send(result);
});

app.post("/sendChatMessage", function(req, res) {
    fs.appendFile("./Chats/" + req.query.video, req.query.msg + "\n", function (err) {
            if (err) throw err;
    });
    res.status(200).send();
});

/*app.listen(8000, function () {
    console.log("Listening on port 8000!");
});*/

io.on("connection", (socket) => {
    console.log("user connected");  
    socket.on("disconnect", function () {
        console.log("user disconnected");
    });
    
    socket.on("createRoom", room => {
        socket.join(room);
        socket.room = room;
    });
  
    socket.on("chat", message => {
        socket.broadcast.to(socket.room).emit("chat", message);
    });
});

server.listen(port, function() {
    console.log(`Listening on port ${port}`);
});