const { error } = require("console");
const express = require("express");
const { disconnect } = require("process");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const PORT = 8000;

// multer 미들웨어 사용하기
const multer = require("multer"); // multer 불러오기
const path = require("path"); // path 불러오기 (내장 모듈) => 파일, 폴더 경로를 쉽게 설정
const upload = multer({
  dest: "uploads/", // dest: 업로드할 파일 경로 지정 ('/'는 폴더를 의미)
});
const uploadDetail = multer({
  storage: multer.diskStorage({
    destination(req, file, done) {
      // destination: 경로 설정
      // (req, file, done) = (요청, 파일, 콜백)
      // done: callback 함수
      done(null, "uploads/");
    },
    filename(req, file, done) {
      const ext = path.extname(file.originalname); // file.originalname 에서 '확장자' 추출
      done(null, path.basename(file.originalname, ext) + Date.now() + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.set("view engine", "ejs");
app.use("/views", express.static(__dirname + "/views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use("/static", express.static(__dirname + "/static"));

app.get("/", function (req, res) {
  console.log("client connected");
  res.render("chat");
});

// 닉네임을 저장할 객체
// : 닉네임이 겹치지 않도록 객체({})를 사용함
// { 소켓_아이디: 닉네임, ... }
const nickObj = {};

// [실습3-2]
// 닉네임 리스트 객체 업데이트
// 유저가 입장하거나 퇴장할 때 내역 업데이트
function updateNickList() {
  io.emit("updateNicks", nickObj);
  // 서버에 접속한 클라이언트들에게 nickObj에 변경이 일어났음을 알리는 이벤트
}

// js object에 key, value 추가하는 방법
// const nickObj = {};

// const socket = { id: 'asdfasdf123412343541' };

// nickObj.hello = '안녕'; // 방법1
// nickObj['apple'] = '사과'; // 방법2
// nickObj[socket.id] = 'sean'

// console.log(nickObj)

// ------------------------------------------------------
// io.on(event_name, callback)
// : socket과 관련된 통신 작업 처리
// 입장 (connect 로 정해져있음 - 변경불가)
io.on("connection", (socket) => {
  // "connection" event
  // - 클라이언트가 접속했을 때 발생하는 이벤트
  // - 콜백으로 socket 객체를 제공

  // 최초 입장시 (연결)
  // socket.id: 소켓 고유 아이디 -> socket은 웹페에지 별로 id 생성!
  // => 크롬에서 탭 2개 띄우면 socket.id 는 각각 생김 (2개)
  console.log("⭕ Server Socket Connected >> ", socket.id);

  //   // [실습1]
  //   socket.on("hello", (data) => {
  //     console.log(`${data.who} : ${data.msg}`);
  //     // server -> client 보낼 때
  //     socket.emit("helloKr", { who: "hello", msg: "안녕~~~" });
  //   });

  //   socket.on("study", (data) => {
  //     console.log(`${data.who} : ${data.msg}`);
  //     socket.emit("studyKr", { who: "study", msg: "공부해!" });
  //   });

  //   socket.on("bye", (data) => {
  //     console.log(`${data.who} : ${data.msg}`);
  //     socket.emit("byeKr", { who: "bye", msg: "잘가ㅎ" });
  //   });

  // [실습3] 채팅창 입장 안내 문구
  //   io.emit("notice", `${socket.id.slice(0, 5)}님이 입장하셨습니다.`); // 다섯글자만 보여줌 (slice)

  // [실습3-2] 채팅창 입장 안내 문구 socket.id -> nickname
  socket.on("setNick", (nick) => {
    console.log("socket on setNick >> ", nick); // 프론트엔드에서 입력한 닉네임 값

    // 닉네임 중복 여부
    if (Object.values(nickObj).indexOf(nick) > -1) {
      // 아이디 중복
      socket.emit("error", "이미 존재하는 닉네임입니다. 다시 입력해주세요!!");
    } else {
      // 아이디 통과
      nickObj[socket.id] = nick; // nickObj 객체에 '소켓_아이디: 닉네임' 추가
      io.emit("notice", `${nick}님이 입장하셨습니다.`); // 입장 메세지 '전체 공지'
      // 전체 공지 -> 서버에 접속한 모든 클라이언트에게 이벤트 전송
      socket.emit("entrySuccess", nick); // 입장 성공시
      updateNickList(); // 닉네임 리스트 객체 업데이트
    }
  });

  // [실습3-3] 접속자 퇴장 (disconnect 로 정해져있음 - 변경불가)
  // disconnect event : 클라이언트가 연결을  끊었을 때 발생 (브라우저 탭 닫음)
  socket.on("disconnect", () => {
    console.log("**** ❌ Sever Socket Disconnected >> ", socket.id);

    // 1. xx님 퇴장하셨습니다. 출력
    io.emit("notice", `${nickObj[socket.id]}님이 퇴장하셨습니다.`); // 퇴장 메세지 '전체 공지'
    // 전체 공지 -> 서버에 접속한 모든 클라이언트에게 이벤트 전송

    // 2. nickObj에서 닫은 탭의 socket.id를 삭제
    delete nickObj[socket.id];

    // 3. 리스트 업데이트
    updateNickList();
  });

  // [실습4] 채팅창 메세지 전송 step1
  socket.on("send", (obj) => {
    console.log("socket on send >> ", obj); // socket on send >>  { myNick: 'sehee', dm:'', msg: '안녕' }
    // [전체] 선택하고 전송시 dm: 'all'
    // 특정 닉네임을 선택하고 전송 -> dm: socket.id

    // [실습4] 채팅창 메세지 전송 Stpe2
    // 서버에 접속한 모든 클라이언트한테 "누가 뭐라고 말했는지" 이벤트 보내기
    const sendData = { nick: obj.myNick, msg: obj.msg };
    // io.emit("newMessage", sendData);

    // [실습5] DM 기능 구현
    // 만약에 dm 메세지라면; 그 특정 socket.id 에게만 메세지 전달
    // { nick, dm, msg }
    // 만약에 dm 메세지가 아니면; 전체 공지
    // { nick, msg }
    if (obj.dm !== "all") {
      // dm 전송
      let dmSocketId = obj.dm; // 각 닉네임에 해당하는 socket.id
      const sendData = { nick: obj.myNick, dm: "(속닥속닥)", msg: obj.msg };
      // 1. dm을 보내고자하는 그 socket.id 한테 메세지 전송
      io.to(dmSocketId).emit("newMessage", sendData);
      // 2. dm을 보내고 있는 자기자신 메세지 전송
      socket.emit("newMessage", sendData);
    } else {
      // all 전송 (전체 공지)
      const sendData = { nick: obj.myNick, msg: obj.msg };
      io.emit("newMessage", sendData);
    }
  });
  // 채팅창 이미지 전송
  socket.on("image", (data) => {
    socket.emit("image", data);
  });
});

// ------- 채팅창 이미지 전송
app.post("/image", upload.single("image"), function (req, res, next) {
  try {
    console.log(req.file);
    var data = req.file;
    res.send(data.location);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// 주의) socket 을 사용할 때는 http.listen으로 PORT 열어야 함!!!
http.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
