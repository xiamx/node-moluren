var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var _ = require('underscore');

var baseUrl = 'http://moluren.net';
var url = {
    chat: [baseUrl, 'chat'].join('/'),
    token: [baseUrl, 'json', 'token'].join('/'),
    connect: [baseUrl, 'json', 'connect'].join('/'),
    poll: [baseUrl, 'json', 'hb'].join('/'),
    say: [baseUrl, 'json', 'say'].join('/'),
//     disconnect: [baseUrl, 'json', 'disconnect'].join('/')
}


var moluren = function(params) {
    var request = require('request');
    this.connected = false;
    this.request = request.defaults({
        jar: request.jar(),
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) ' +
            'AppleWebKit/537.2 (KHTML, like Gecko) ' +
            'Chrome/22.0.1216.0 Safari/537.2'
        },
        proxy: params.proxy
    })

}

util.inherits(moluren, EventEmitter);

moluren.prototype.connect = function() {
    var that = this;
    async.waterfall([
        function(callback){
            that.request(url.chat, callback);
        },
        function(response, body, callback){
            that.request.post({
                url: url.token,
                form: {
                    t: (new Date).getTime()
                },
                json: true
             }, callback);
        },
        function(response, body, callback){
            if (body){
                that._token = body.token
                callback(null, that._token);
            } else {
                callback("no token");
            }
        },
        function(token, callback){
            that.request({
                url: url.connect,
                json: true,
                form: {_token_id_: token}
            }, callback)
        },
        function(response, body, callback){
            if (body.connect){
                callback(null);
            } else {
                callback("did not connect");
            }
        }
    ], function(err, result) {
        if (err) {
            console.log('attempted to connect but failed, retrying')
            that.connect();
        } else {
            that.connected = true;
            that.emit('connected');
            that.poll();
        }
    });
};

moluren.prototype.poll = function() {
    var that = this;
    that.request({
        url: url.poll,
        json: true
    }, function(error, response, body){
        if (!body || !body.hb) {
            if (that.connected) {
                that.poll();
            }
            return;
        }
        if (body.hb.conn){
            if(body.hb.msgs.length > 0) {
                var msgContent = _.map(body.hb.msgs, function(msg){
                    return msg.c;
                });
                that.emit('received', msgContent);
            }
        } else {
            console.log(that._token, 'remote disconnected');
            that.connected = false;
            that.emit('disconnected');
            return;
        }
        that.poll();
    });
}

moluren.prototype.say = function(messages){
    var that = this;
    if (!util.isArray(messages)) {
        messages = [messages];
    }
    async.map(messages, function(message, callback){
        that.request.post({
            url: url.say,
            form: {
                _token_id_: that._token,
                _message_: message,
                _h_:(new Date).getTime(),
                t:(new Date).getTime()
            },
            json: true
        }, callback);
    }, function(err, results){
        if (err) {
            console.log(that._token, 'Error with saying', messages);
        } else {
            that.emit('said', messages);
        }
    });
}

moluren.prototype.disconnect = function() {
    var that = this;
    that.request({
        url: url.disconnect,
        form: {
            _token_id_: that._token
        },
        json: true
    }, function(err, results){
        that.emit('disconnected');
    });
}


module.exports = moluren;
