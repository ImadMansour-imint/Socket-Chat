const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const shortid = require('shortid');
const ROOM = require('./room.js');
const PrivateRoom = require('./private_room.js');
// Import from Nguyen
const auth = require('./auth').auth;
const User = require('./user.js').User;
const Token = require('./user.js').Token;

let user = [];
let token = [];


//cette fonction pour la creation de ID groupe , chat ou appel video soit unique
function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }

 const id = makeid(10)



 //creation d'API Page login
app.get(`/`, (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});


//==========================================
// creation de la page d'accueil ou la page pricipal de chat 
app.get(`/chat`, (req, res) => {

    //servir la page html pour ce route
    res.sendFile(__dirname + '/views/index.html');
    res.redirect(`/chat/${id}`);
});


//creation de route dynamic pour chaque chat page
app.get('/chat/:id',(req,res)=>{
    res.sendFile(__dirname + '/views/index.html');

})

const allRoomObj = {};
const roomList = {};
const allPrivateRoom = {};


//==============================================
// GROUPE FONCTIONS
//==============================================
/**
 * Créer fonction de groupe
 * @param {*} roomName - received from client-side
 * @param {*} clientID - received from client-side
 */
// roomID is not yet generated randomly to run tests
const createRoom = (clientId, roomName) => {
    // check if both params are passed into
    if (typeof clientId === 'undefined' || typeof roomName === 'undefined') {
        throw new Error('Error: params are not passed into the function');
    } else {
        let roomId = shortid.generate();
        let newRoom = new ROOM(roomId, roomName, clientId);
        allRoomObj[roomId] = newRoom;
        roomList[roomId] = roomName;
        return roomId;
    }
}

/**
 * Delete a room function
 * @param {*} clientID 
 * @param {*} roomID 
 */
const deleteRoom = (clientID, roomID) => {
    if (typeof clientID === 'undefined' || typeof roomID === 'undefined') {
        throw new Error('Error: params are not passed into the function');
    } else if (allRoomObj[roomID] === undefined) {
        throw new Error('Error: Room does not exist !!');
    } else {
        // only allows the room's creator
        let roomCreator = allRoomObj[roomID].creator;
        if (clientID !== roomCreator) {
            throw new Error("Error: Only the room's creator is allowed to delete it !!");
        } else {
            delete allRoomObj[roomID];
            delete roomList[roomID];
        }
    }
}

/**
 * Clients join rooms function -> add clients to room
 * @param {*} clientID 
 * @param {*} roomID 
 */
const joinRoom = (clientID, roomID) => {
    if (typeof clientID === 'undefined' || typeof roomID === 'undefined') {
        throw new Error('Error: params are not passed into the function');
    } else if (allRoomObj[roomID] === undefined) {
        throw new Error('Error: Room does not exist !!');
    } else {
        let room = allRoomObj[roomID];
        room.addClient(clientID);
    }
}

/**
 * Clients leave rooms function -> remove clients from room
 * @param {*} clientID 
 * @param {*} roomID
 */
const leaveRoom = (clientID, roomID) => {
    if (typeof clientID === 'undefined' || typeof roomID === 'undefined') {
        throw new Error('Error: params are not passed into the function');
    } else if (allRoomObj[roomID] === undefined) {
        throw new Error('Error: Room does not exist !!');
    } else {
        let room = allRoomObj[roomID];
        room.removeClient(clientID);
    }
}

/**
 * Clients change the room's name -> only allow the room's creator to change name
 * @param {*} clientID 
 * @param {*} roomID 
 * @param {*} newRoomName 
 */

const changeRoomName = (clientID, roomID, newRoomName) => {
    if (typeof clientID === 'undefined' || typeof roomID === 'undefined' || typeof newRoomName === 'undefined') {
        throw new Error('Error: params are not passed into the function');
    } else if (allRoomObj[roomID] === undefined) {
        throw new Error('Error: Room does not exist !!');
    } else {
        let room = allRoomObj[roomID];
        let roomCreator = allRoomObj[roomID].creator;
        if (clientID !== roomCreator) {
            throw new Error("Error: Only the room's creator is allowed to change room name !!");
        } else {
            room.changeName(newRoomName);
            roomList[roomID] = newRoomName;
        }
    }
}

//=============================================
// PRIVATE ROOM FUNCTIONS
//=============================================
const createPrivateRoom = (senderId, receiverId, senderName, receiverName) => {
    // check if both params are passed into
    if (typeof senderId === 'undefined' || typeof receiverId === 'undefined' || typeof senderName === 'undefined' || typeof receiverName === 'undefined') {
        throw new Error('Error: params are not passed into the function');
    } else {
        let newPrivateRoom = new PrivateRoom(senderId, receiverId, senderName, receiverName);
        newPrivateRoom.addClient(receiverId);
        let roomId = newPrivateRoom.id;
        allPrivateRoom[roomId] = newPrivateRoom;
        return roomId;
    }
}

//==============================================
// SOCKET.IO EVENTS
//==============================================
const main = io.on('connection', (socket) => {

    // receive clientId when an user logins
    socket.on('send clientId', (id) => {
        // new code to fix room msg events
        // default join 'main' room
        socket.join('main')
        //============================
        let clientId = id;
        // find the client info with clientId
        let connectClient = user.find(ele => ele.id === clientId);
        // store the current socket.id in the user obj to be used for private msg
        connectClient.socketId = socket.id;
        socket.username = connectClient.username;
        io.to(socket.id).emit('reconnect', connectClient, roomList);
        io.sockets.emit('user connect', connectClient, roomList, user);
    });
    //=================================
    // socket.on('disconnect', () => {
    //     // 
    //     console.log(user);
    //     let disconnectClient = user.find(ele => ele.socketId === socket.id);
    //     socket.broadcast.emit('user disconnect', disconnectClient.username);
    //     console.log(socket.username + ' disconnected');
    //     console.log(user);
    // });

    //===================================
    // IMPORT FROM Nguyen
    auth(socket, user, token);
    //===================================
    // Handle private msg events
    //===================================
    socket.on('send private', (senderId, receiverId) => {
        // get sender and receiver data in user array
        let sender = user.find(ele => ele.id === senderId);
        let receiver = user.find(ele => ele.id === receiverId);
        // get the obj contains private chat rooms of the sender
        let senderFriend = sender.friend;
        // check if a room is already created between these two users 
        if (senderFriend.hasOwnProperty(receiverId)) {
            let roomId = senderFriend[receiverId];
            let roomName = allPrivateRoom[roomId].name;
            // send back the roomId, roomName, senderName, receiverName to sender -> create chat room in front send
            socket.emit('create private chat', roomId, roomName, sender.username, receiver.username);
        } else {
            // create a new private room
            let newRoomId = createPrivateRoom(senderId, receiverId, sender.username, receiver.username);
            console.log('newRoomId: ' + newRoomId);
            let newRoomName = allPrivateRoom[newRoomId].name;
            // update friend list of both users
            sender.friend[receiverId] = newRoomId;
            receiver.friend[senderId] = newRoomId;
            // send back the roomId, roomName, senderName, receiverName to sender -> create chat room in front send
            socket.emit('create private chat', newRoomId, newRoomName, sender.username, receiver.username);
        }
    })
    // when an user wants to send a private msg -> find receiver -> emit msg and create a chat box in receiver window
    socket.on('private message', (data) => {
        // find sender in user array by socketId
        let sender = user.find(ele => ele.socketId === socket.id);
        // get senderId
        let senderId = sender.id;
        // from roomId -> get receiverId
        let receiverId = data.roomId.split('--').find(ele => ele !== senderId);
        // get socket.id of receiver to emit msg 
        let receiverSocketId = user.find(ele => ele.id === receiverId).socketId;
        let roomName = allPrivateRoom[data.roomId].name;
        // only emit msg to the receiver via receiverSocketId
        socket.broadcast.to(receiverSocketId).emit('private message', {
            roomId: data.roomId,
            roomName: roomName,
            username: sender.username,
            message: data.message
        })
    })

    //======================================================
    // Handle public room events: join, leave, create, delete
    //=======================================================
    socket.on('create room', (roomName, clientId) => {
        try {
            // have user info -> use clientId not socket.id
            let newRoomId = createRoom(clientId, roomName);
            let client = user.find(ele => ele.id === clientId);
            client.room.push(newRoomId);
            // emit a msg back to the sender
            socket.emit('new room', {
                clientName: socket.username,
                newRoomId: newRoomId,
                newRoomName: roomList[newRoomId]
            });
            io.sockets.emit('update room', roomList);
            // new code to fix room msg events -> join newly created room
            socket.join(newRoomId)
            console.log(socket.room);
            console.log(io.sockets.adapter.rooms[newRoomId]);
            //============================
        } catch (err) {
            console.log(err);
            socket.emit('create room error', socket.username, err);
        }
    });

    socket.on('join room', (clientId, roomId) => {
        // check if the client is already in the room
        let alreadyInRoom = allRoomObj[roomId].client.some(ele => ele === clientId);
        if (!alreadyInRoom) {
            joinRoom(clientId, roomId);
            let client = user.find(ele => ele.id === clientId);
            client.room.push(roomId);
            // new code to fix room msg events -> join room
            // console.log(io.sockets.adapter.rooms[roomId]);
            socket.join(roomId)
            // console.log(io.sockets.adapter.rooms[roomId]);
            //============================
            // emit a msg back to the sender
            socket.emit('join room', {
                clientName: socket.username,
                roomId: roomId,
                roomName: roomList[roomId]
            });
        } else {
            socket.emit('join room error', "You are already in the room!");
        }
    });

    socket.on('leave room', (clientId, roomId) => {
        let alreadyInRoom = allRoomObj[roomId].client.some(ele => ele === clientId);
        if (alreadyInRoom) {
            leaveRoom(clientId, roomId);
            let client = user.find(ele => ele.id === clientId);
            let roomIndex = client.room.indexOf(roomId);
            client.room.splice(roomIndex, 1);
            // new code to fix room msg events -> leave room
            // console.log(io.sockets.adapter.rooms[roomId]);;
            socket.leave(roomId)
            // console.log(io.sockets.adapter.rooms[roomId]);;
            //============================
            // emit a msg back to the sender
            socket.emit('leave room', {
                clientName: socket.username,
                roomId: roomId,
                roomName: roomList[roomId]
            });
        } else {
            socket.emit('leave room error', "You are not in the room!");
        }

    });

    socket.on('delete room', (clientId, roomId) => {
        let roomName = roomList[roomId];
        try {
            deleteRoom(clientId, roomId);
            let client = user.find(ele => ele.id === clientId);
            let roomIndex = client.room.indexOf(roomId);
            client.room.splice(roomIndex, 1);
            // new code to fix room msg events -> delete room
            // console.log(io.sockets.adapter.rooms[roomId]);
            // remove all clients from the room
            // get array of all clients in 'roomId'
            io.in(roomId).clients(function (error, clients) {
                if (clients.length > 0) {
                    console.log('clients in the room: ');
                    console.log(clients);
                    clients.forEach(function (socket_id) {
                        // clients leave room
                        io.sockets.sockets[socket_id].leave(roomId);
                    });
                }
            });
            // console.log(io.sockets.adapter.rooms[roomId]);
            //============================
            // emit to all clients new roomList -> update room list
            io.sockets.emit('delete room', roomId, roomName, roomList);
        } catch (err) {
            console.log(err);
            // emit a msg back to the sender
            socket.emit('delete room error', err.message);
        }
    })

    //================================================
    // Handle chat msg events -> broadcast to the room
    //================================================
    socket.on('chat message', (data) => {
        // emit msg to clients in the room only
        socket.broadcast.to(data.roomId).emit('chat message', {
            roomId: data.roomId,
            username: socket.username,
            message: data.message
        });
    });
})


//===========================================
// LISTEN ON PORT 3000
//===========================================
http.listen(3000, () => {
    console.log('listening on *:3000');
});