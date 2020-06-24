/*
 *
 */
import SimplePeer from 'simple-peer';
import $ from 'jquery';
import socketIOClient from 'socket.io-client';
import { Emitter } from './emmiter';
import axios from 'axios';
//const socket = socketIOClient.connect('http://54.160.110.155:5000'); //will be replaced by an appropriate room.
const socket = socketIOClient.connect(`${global.config.backendURL}`); //will be replaced by an appropriate room.
//const socket = socketIOClient.connect('http://localhost:5000');
socket.connect();
socket.on('connect', () => {
  console.log(socket.connected); // true
  console.log(socket.id);
});

export class Peer extends Emitter {
  constructor(it, stream, room, initiator, their_id, their_name, my_id) {
    super();
    this.error = null;
    this.active = false;
    this.stream = null;
    this.their_id = their_id;
    this.their_name = their_name;
    this.my_id = my_id;
    this.room = room;
    this.initiator = initiator;
    this.peer = new SimplePeer({
      initiator: initiator,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:numb.viagenie.ca',
            credential: 'HWeF3pu@u2RfeYD',
            username: 'veddandekar6@gmail.com'
          }
        ]
      }
    });

    this.peer.on('error', (err) => {
      this.error = err;
      this.emit('error', err);
      this.close();
      console.log('Error Occured while connecting!', err);
    });

    this.peer.on('close', (_) => {
      this.close();
      console.log('closed');
    });
    console.log('in constructor');
    this.peer.on('signal', (data) => {
      console.log(data);
      console.log(this.my_id);
      console.log(this.their_id);
      var room = this.room;
      socket.emit('signalling', room, data, this.their_id, this.my_id, (resp) => {
        console.log('reply rcvd');
        console.log(data);
      });
      console.log('received signal to be seint');
    });
    this.peer.on('data', (data) => {
      console.log('recvd data from remote peer');
    });
    this.peer.on('connect', (data) => {
      console.log('connected');
    });
    this.peer.on('stream', (data) => {
      const self = this;
      console.log('stream received');
      createVideoElement(self, data, self.their_id, self.their_name);
      /*
      var reqData = {
        id: my_id,
        type: 0,
        roomName: this.room
      };
      axios
        .post(`${global.config.backendURL}/api/room/goonlinesimple`, reqData, {
          headers: {
            'milaap-auth-token': localStorage.getItem('milaap-auth-token')
          }
        })
        .then((res) => {
          res.data.online.map((each) => {
            if (each.id === self.their_id)
              createVideoElement(self, data, self.their_id, each.username);
          });
        });
        */
    });
    socket.on('signalling', (data, from_id) => {
      if (from_id != this.their_id) {
        return;
      }
      console.log(data);
      console.log(from_id);
      console.log(this.my_id);
      console.log(this.their_id);
      console.log(this.peer);
      console.log(this.peer.initiator);
      if (this.peer && !this.peer.destroyed) {
        console.log('replying');
        this.peer.signal(data);
      }
    });
  }

  close() {
    this.emit('close');
    this.active = false;
    this.peer.destroy();
    deleteVideoElement(this.their_id);
  }

  startCall() {
    console.log('starting call');
  }
}

function muteVideo(self, id) {
  const userStream = document.getElementById(id).srcObject;
  if (userStream.getAudioTracks()[0].enabled)
    userStream.getAudioTracks()[0].enabled = false;
  else userStream.getAudioTracks()[0].enabled = true;
}

export function createVideoElement(self, stream, friendtkn, username) {
  const wrapper = document.createElement('div');
  const video = document.createElement('video');
  const nameTag = document.createElement('div');
  const context = document.getElementById('context');
  nameTag.classList.add('name-label');
  nameTag.innerText = username || 'me';
  video.width = '200';
  video.id = friendtkn;
  if (video.id == 'me') {
    video.muted = 'true';
  }
  video.height = '350';
  video.srcObject = stream;
  video.autoplay = true;
  video.onclick = switchContext;
  video.addEventListener(
    'contextmenu',
    function (e) {
      e.preventDefault();
      muteVideo(self, friendtkn);
    },
    false
  );

  wrapper.appendChild(video);
  wrapper.appendChild(nameTag);
  document.getElementById('videos').appendChild(wrapper);
  if (!context.srcObject) switchContext(document.getElementById(friendtkn));
}

export function switchContext(e) {
  if (e.target) e = e.target;
  try {
    const context = document.getElementById('context');
    if (e.srcObject == context.srcObject) return;
    const username = e.nextElementSibling.innerText;
    context.style.display = 'inline';
    context.poster =
      'https://dummyimage.com/1024x576/2f353a/ffffff.jpg&text=' + username;
    context.srcObject = e.srcObject;
    context.play();
    $('#context').removeClass().addClass(e.id);
  } catch (err) {
    console.log('The selected stream is old');
    console.log(err);
  }
}

export async function getMyMediaStream(self, type) {
  if (type === 'screen') {
    // TODO: Add try catch to handle case when user denies access

    await navigator.mediaDevices
      .getDisplayMedia({
        video: { width: 1024, height: 576 },
        audio: true
      })
      .then((media) => {
        self.setState({
          myScreenStreamObj: media
        });
        createVideoElement(self, media, 'me');
        return media;
      });
  } else if (type === 'video') {
    // TODO: Add try catch to handle case when user denies access

    await navigator.mediaDevices
      .getUserMedia({
        video: { width: 1024, height: 576 },
        audio: true
      })
      .then((media) => {
        self.setState({
          myMediaStreamObj: media
        });
        createVideoElement(self, media, 'me');
        return media;
      });
  }
}
export function startCall(self, roomName, type) {
  var my_id = socket.id;
  console.log(my_id);
  // Go online and get online array from express server.
  var reqData = {
    id: my_id,
    type: 0,
    roomName: roomName
  };
  axios
    .post(`${global.config.backendURL}/api/room/goonlinesimple`, reqData, {
      headers: {
        'milaap-auth-token': localStorage.getItem('milaap-auth-token')
      }
    })
    .then((res) => {
      console.log(res);
      var onlineArray = res.data.online;
      // Get myMyMediaStream
      getMyMediaStream(self, type).then((media) => {
        console.log('media object found');
        // Add eventhandler for "createConnection" signal, On receiving the signal:
        self.setState({
          myPeers: []
        });
        socket.on('startconn', (their_id, their_name) => {
          console.log('connection received from server');
          console.log(their_id);
          console.log(my_id);
          console.log(socket.id);
          var my_id = socket.id;
          console.log(my_id);
          var mediaStream;
          if (type == 'video') {
            mediaStream = self.state.myMediaStreamObj;
          } else if (type == 'screen') {
            mediaStream = self.state.myScreenStreamObj;
          } else {
            mediaStream = null;
          }
          // Create a new peer with initiator = false
          var peer = new Peer(
            true,
            mediaStream,
            self.state.roomName,
            false,
            their_id,
            their_name,
            my_id
          );
          self.setState({
            myPeers: [...self.state.myPeers, peer]
          });
          console.log(self.state.myPeers);
        });

        axios
          .get(`${global.config.backendURL}/api/user/getUserName`, {
            headers: {
              'milaap-auth-token': localStorage.getItem('milaap-auth-token')
            }
          })
          .then((resp) => {
            // Loop through online Array and make connections to online Peers
            onlineArray.forEach((val, index) => {
              console.log(resp.data);
              // Ignore self;
              if (val.username === resp.data.username /*&& val.type === type*/) {
                return;
              }
              console.log('Connecting to ' + onlineArray[index]);
              var their_id = onlineArray[index].id;
              var their_name = onlineArray[index].username;
              var my_name = resp.data.username;
              //    create a new Peer with initiator = true
              var my_id = socket.id;
              socket.emit('startconn', their_id, my_id, my_name, (resp) => {
                console.log('start conn emited');
                console.log(their_name);
                var my_id = socket.id;
                //var peer = new Peer(true, self.state.myMediaStreamObj, self.state.roomName, true, their_id, my_id);
              });
              console.log('start conn emited');
              console.log(socket.id);
              console.log(my_id);
              var mediaStream;
              if (type == 'video') {
                mediaStream = self.state.myMediaStreamObj;
              } else if (type == 'screen') {
                mediaStream = self.state.myScreenStreamObj;
              } else {
                mediaStream = null;
              }
              var my_id = socket.id;
              var peer = new Peer(
                true,
                mediaStream,
                self.state.roomName,
                true,
                their_id,
                their_name,
                my_id
              );
              self.setState({
                myPeers: [...self.state.myPeers, peer]
              });
              console.log(self.state.myPeers);
            });
          });
      });
    })
    .catch((err) => {
      console.log(err);
    });
}
function sendRequestToEndCall(self) {
  const reqData = {
    roomName: self.state.roomName
  };
  axios
    .post(`${global.config.backendURL}/api/room/exitstreamsimple`, reqData, {
      headers: {
        'milaap-auth-token': localStorage.getItem('milaap-auth-token')
      }
    })
    .then((res) => {
      console.log(res.data);
      var idToBeDestroyed = res.data.idToBeDestroyed;
      console.log(self.state.myPeers);
      self.state.myPeers.forEach((val, index) => {
        if (val) {
          console.log(val);
          val.peer.destroy('Call Ended');
        }
      });
      // Clear all state variables associated with calls.
      self.setState({
        myPeers: []
      });
      return;
    })
    .catch((err) => {
      console.log(err);
      return;
    });
}
export async function endCall(self) {
  await sendRequestToEndCall(self);
  if (self.state.myMediaStreamObj) {
    self.state.myMediaStreamObj.getTracks().forEach((track) => {
      console.log(track);
      track.stop();
    });
    self.state.myMediaStreamObj.getTracks().forEach((track) => {
      self.state.myMediaStreamObj.removeTrack(track);
    });
    self.setState({
      myMediaStreamObj: null
    });
  }
  if (self.state.myScreenStreamObj) {
    self.state.myScreenStreamObj.getTracks().forEach((track) => {
      console.log(track);
      track.stop();
    });
    self.state.myScreenStreamObj.getTracks().forEach((track) => {
      self.state.myScreenStreamObj.removeTrack(track);
    });
    self.setState({
      myScreenStreamObj: null
    });
  }
  // Add by appropriate UI changes which clears the screen.
  deleteAllVideoElements();
}

function deleteAllVideoElements() {
  $('#videos').empty();
  //$('#context').empty();
  clearContext();
}

function clearContext() {
  const context = document.getElementById('context');
  if (context != null) {
    context.srcObject = null;
    context.style.display = 'none';
  }
}
function deleteVideoElement(id) {
  const video = document.getElementById(id);
  const context = $('#context');
  if (video) {
    video.nextElementSibling.remove();
    video.remove();
  }
  if (context.hasClass(id)) {
    clearContext();
  }
}

export function addScreenShareStream(self) {
  return;
  self.state.myPeers.forEach((val, index) => {});
}
