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

  socket.on('findStranger', ({ myGender, targetGender }) => {
    removeFromQueue(socket);
    socket.myGender = myGender;
    socket.targetGender = targetGender;
    socket.isSearching = true;

    let matched = null;
    if (targetGender === 'male') {
      const idx = waitingMale.findIndex(s => s.targetGender === myGender && s.isSearching);
      if (idx !== -1) matched = waitingMale.splice(idx, 1)[0];
    } else {
      const idx = waitingFemale.findIndex(s => s.targetGender === myGender && s.isSearching);
      if (idx !== -1) matched = waitingFemale.splice(idx, 1)[0];
    }

    if (matched) {
      pairs[socket.id] = matched.id;
      pairs[matched.id] = socket.id;
      socket.isSearching = false;
      matched.isSearching = false;
      socket.emit('matched', { peerGender: targetGender });
      matched.emit('matched', { peerGender: myGender });
    } else {
      if (myGender === 'male') waitingMale.push(socket);
      else waitingFemale.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('cancelSearch', () => {
    socket.isSearching = false;
    removeFromQueue(socket);
  });

  socket.on('message', (msg) => {
    const peerId = pairs[socket.id];
    if (peerId) io.to(peerId).emit('message', msg);
  });

  socket.on('next', () => {
    socket.isSearching = false;
    const peerId = pairs[socket.id];
    if (peerId) {
      const peer = io.sockets.sockets.get(peerId);
      if (peer) {
        peer.isSearching = false;
        peer.emit('peerLeft');
      }
      delete pairs[peerId];
      delete pairs[socket.id];
    }
    removeFromQueue(socket);
  });

  socket.on('disconnect', () => {
    onlineCount--;
    io.emit('onlineCount', onlineCount);
    socket.isSearching = false;
    removeFromQueue(socket);
    const peerId = pairs[socket.id];
    if (peerId) {
      io.to(peerId).emit('peerLeft');
      delete pairs[peerId];
      delete pairs[socket.id];
    }
  });
});

function removeFromQueue(socket) {
  const mi = waitingMale.indexOf(socket);
  if (mi !== -1) waitingMale.splice(mi, 1);
  const fi = waitingFemale.indexOf(socket);
  if (fi !== -1) waitingFemale.splice(fi, 1);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server chal raha hai port ' + PORT + ' par'));