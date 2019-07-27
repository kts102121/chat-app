const path = require('path');
const http = require('http');
const express = require('express');
const hbs = require('hbs');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const port = process.env.PORT;

// Define paths for Express config
const publicDirPath = path.join(__dirname, '../public');
const viewsPath = path.join(__dirname, '../templates/views');
const partialsPath = path.join(__dirname, '../templates/partials');

// Setup handlebars engine and views location
app.set('view engine', 'hbs');
app.set('views', viewsPath);
app.set('x-powered-by', false);
hbs.registerPartials(partialsPath);

// Setup static directory to serve
app.use(express.static(publicDirPath));

// let count = 0;
// server (emit) => client (receive) = countUpdated
// client (emit) => server (receive) = increment

io.on('connection', (socket) => {
  console.log('New WebSocket connection');

  socket.on('join', ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) {
      callback(error);
    } else {
      socket.join(user.room);
      socket.emit('message', generateMessage('Admin', 'Welcome!'));
      socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`));
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
      callback();
    }
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!');
    }

    io.to(user.room).emit('message', generateMessage(user.username, message));
    return callback();
  });

  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit('locationMessage', generateLocationMessage(
      user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`,
    ));
    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`));
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

app.get('', (req, res) => {
  res.render('index', {
  });
});

app.get('/chat', (req, res) => {
  res.render('chat', {
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
