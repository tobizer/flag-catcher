var io = require('socket.io');
var util = require('util');
var db = require('../models');
var cookie  =   require('cookie');
var connect =   require('connect');
var userReader = require('../utils/user_reader');


exports.initialize = function (server, sessionStore, cookieParser) {
    io = io.listen(server);
    io.set('authorization', function (handshakeData, accept) {
        // check if there's a cookie header
        if (handshakeData.headers.cookie) {
            var a = cookie.parse(handshakeData.headers.cookie);
            handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
            handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], 'secret');
            if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
                // reject the handshake
                return accept('Cookie is invalid.', false);
            }

            //check if signed with passport
            if (sessionStore.sessions[handshakeData.sessionID] !== undefined) {
                var userPassport = JSON.parse(sessionStore.sessions[handshakeData.sessionID]);
                if (userPassport.passport.user === undefined) {
                    console.log('rejecting because passport is invalid');
                    return accept('passport is invalid.', false);
                }
            }
        } else {
            return accept('No cookie transmitted.', false);
        }
        accept(null, true);
    });
    var SessionSockets = require('session.socket.io')
        , sessionSockets = new SessionSockets(io, sessionStore, cookieParser);
    sessionSockets.on('connection', function (err, socket, session) {
        //your regular socket.io code goes here
        //and you can still use your io object

        socket.on('joingame', function(gameId) {
            var user = userReader.getUser(socket.handshake.headers.cookie, sessionStore);
            socket.set('user', user, function() {
                db.Game.find({where: {id: gameId, isOver: 0, isRunning: 0}, include: [db.User]})
                    .success(function(game) {
                        socket.room = gameId;
                        socket.join(gameId);
                        socket.in(socket.room).broadcast.send(JSON.stringify({message: user.username + ' has joined the game'}));
                        socket.in(socket.room).send(JSON.stringify({message: user.username + ' has joined the game'}));
                    }).error(function(err) {});
            });
        });

    });



};
