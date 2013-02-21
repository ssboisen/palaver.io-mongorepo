var Q = require('q')
  , util = require('util')
  , _ = require('underscore')
  , palaver = require('palaver.io')
  , mongojs = require('mongojs');

module.exports = MongoChatRepositoryFactory

function makeMongodbResolver (deferred) {
    return function (error, value) {
        if (error) {
            deferred.reject(error);
        } else if (arguments.length > 1) {
            deferred.resolve(value);
        }
        else{
            deferred.resolve();
        }
    };
};

function MongoChatRepositoryFactory(mongoUrl) {

    var db = mongojs(process.env.MONGOURL || mongoUrl || 'palaver');
    var rooms = db.collection('rooms');
    var users = db.collection('users');

    util.inherits(MongoChatRepository, palaver.AbstractChatRepository);

    function MongoChatRepository(){
        this.joinRoom = function(roomName, username){
            var deferred = Q.defer();

            rooms.findOne({ name: roomName }, makeMongodbResolver(deferred));

            return deferred.promise.then(function (room) {
                
              if(!room) {
                room = { name: roomName, users: [ ], messages: [] };
              }

              if(!_.any(room.users, function(user) { return user.username === username; })) {
                room.users.push({username: username, online: true });
              }

              var saveDef = Q.defer();
              rooms.save(room, makeMongodbResolver(saveDef));

              return saveDef.promise.then(function () { return room; });
            });
        };

        this.leaveRoom = function(roomName, username){
            var deferred = Q.defer();

            rooms.update({ name: roomName }, { $pop: { users: { username: username}}}, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.addMessageToRoom = function(roomName, message){
            var deferred = Q.defer();

            rooms.update({name: roomName}, { $push: { messages: message}}, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.roomsForUser = function(username){
            var deferred = Q.defer();

            rooms.find({ "users.username" : username }, makeMongodbResolver(deferred));

            return deferred.promise;
        };

        this.findUser = function(username){
            var deferred = Q.defer();

            users.find({ username: username }, makeMongodbResolver(deferred));

            return deferred.promise.then(function(docs){
                if(docs.length === 1){
                    return docs[0];
                }

                return null;
            });
        };

        this.userConnected = function(userName) {
          var def = Q.defer();

          users.findAndModify({
            query: { username: userName }, 
            update: { $inc: { connectionCount: 1 } },
            new: true
          }, makeMongodbResolver(def));

          return def.promise.then(function (user) {
            var udef = Q.defer();

            user.online = true;

            rooms.update({ 'users.username': userName }, { $set: { 'users.$.online': true } }, { multi: true }, 
                         makeMongodbResolver(udef));

            return udef.promise.then(function () { return user; });
          });
        };

        this.userDisconnected = function(userName) {
          var def = Q.defer();

          users.findAndModify({
            query: { username: userName }, 
            update: { $inc: { connectionCount: -1 } },
            new: true
          }, makeMongodbResolver(def));

          return def.promise.then(function (user) {
            var udef = Q.defer();

            if(user.connectionCount === 0) {
              rooms.update({ 'users.username': userName }, { $set: { 'users.$.online': false } }, { multi: true }, 
                           makeMongodbResolver(udef));
              user.online = false;
            }
            else {
              udef.resolve();
              user.online = true;
            }

            return udef.promise.then(function () { return user; });
          });
        };
    };

    return MongoChatRepository;
};
