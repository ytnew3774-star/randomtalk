const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'Public')));

const waitingMale = [];
const waitingFemale = [];
const pairs = {};
let onlineCount = 0;

io.on('connection', (socket) => {
  onlineCount++;
  io.emit('onlineCount', onlineCount);
  console.log('User connected:', socket.id, '| Online:', onlineCount);

  socket.on('findStranger', ({ myGender, targetGender }) => {
    socket.myGender = myGender;
    socket.targetGender = targetGender;

    let matched = null;
    if (targetGender === 'male') {
      const idx = waitingMale.findIndex(s => s.targetGender === myGender);
      if (idx !== -1) matched = waitingMale.splice(idx, 1)[0];
    } else {
      const idx = waitingFemale.findIndex(s => s.targetGender === myGender);
      if (idx !== -1) matched = waitingFemale.splice(idx, 1)[0];
    }

    if (matched) {
      pairs[socket.id] = matched.id;
      pairs[matched.id] = socket.id;
      socket.emit('matched', { peerGender: targetGender });
      matched.emit('matched', { peerGender: myGender });
    } else {
      if (myGender === 'male') waitingMale.push(socket);
      else waitingFemale.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('message', (msg) => {
    const peerId = pairs[socket.id];
    if (peerId) io.to(peerId).emit('message', msg);
  });

  socket.on('next', () => {
    disconnectPeer(socket);
    socket.emit('findNext');
  });

  socket.on('disconnect', () => {
    onlineCount--;
    io.emit('onlineCount', onlineCount);
    disconnectPeer(socket);
    const mi = waitingMale.indexOf(socket);
    if (mi !== -1) waitingMale.splice(mi, 1);
    const fi = waitingFemale.indexOf(socket);
    if (fi !== -1) waitingFemale.splice(fi, 1);
    console.log('User disconnected | Online:', onlineCount);
  });
});

function disconnectPeer(socket) {
  const peerId = pairs[socket.id];
  if (peerId) {
    io.to(peerId).emit('peerLeft');
    delete pairs[peerId];
    delete pairs[socket.id];
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server chal raha hai port ' + PORT + ' par'));