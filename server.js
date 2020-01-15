module.exports = (config) => {
	return new Server(config);
};
const rClient = require('./client.js');
const {
	ActionId,
	ActionList,
	Proto,
	Convert
} = rClient;

class Server {
	constructor(config) {
		this.rooms = {};
	}
	addClient(args) {
		if (typeof args !== 'object') throw 'first argumet in addClient must be object with key "send"\nExample: voicer.addClient({send: function})';
		args.server = this;
		return new Client(args);
	}
}
class Client {
	constructor(config) {
		this.server = config.server;
		this.ws = config.ws;
		if (typeof config.send !== 'function') throw 'in function addClient "send" must be function\nExample: voicer.addClient({send: function})';
		this.send = config.send;
		this.userId = config.userId;
		this.clientId = config.clientId || GenID();
		// this.initSegments = {};
	}
	sendBuf(action, data) {
		// try {
			return this.send(this.bufferify(action, data));
		// } catch (e) {
		// 	console.log('gg')
		// }
	}

	bufferify(action, data) {
		return Convert.bufferify(action, data, 'in');
		return Buffer.from([action, ...new TextEncoder("utf-8").encode(JSON.stringify(data))]);
	}
	bufferParse(data) {
		return Convert.bufferParse(data, 'out');
		return {
			action: data[0],
			data: JSON.parse(new TextDecoder("utf-8").decode(Buffer.from(data.slice(1)))),
		};
	}

	receive(data) {
		data = this.bufferParse(data);
		if (ActionList[data.action] && this['action_' + ActionList[data.action]])
			this['action_' + ActionList[data.action]](data.data);
		else console.log('receive', data)
	}
	action_joinRoom(data) {
		let connections = [];
		if (this.roomId)
			this.close();
		this.roomId = data.roomId;
		let roomList = this.server.rooms[this.roomId] = this.server.rooms[this.roomId] || [];
		roomList.push(this);
		for (let i = 0; i < roomList.length; i++) {
			let clientId = roomList[i].clientId;
			if (clientId == this.clientId) continue;
			connections.push({
				clientId: roomList[i].clientId,
				userId: roomList[i].userId,
				// initSegments: Object.values(roomList[i].initSegments),
			});
			roomList[i].sendBuf(ActionId.newPeerConnected, {
				clientId: this.clientId,
				userId: this.userId,
			});
		};
		this.sendBuf(ActionId.joinRoom, {
			connections,
			clientId: this.clientId,
			userId: this.userId,
		});
	}
	action_mediaData(data) {
		let roomList = this.server.rooms[this.roomId];
		data.clientId = this.clientId;
		// console.log(data)
		// if (!this.initSegments[data.streamId] && data.data.length > 10)
		// 	this.initSegments[data.streamId] = data;
		// console.log(roomList,data);
		for (let i = 0; i < roomList.length; i++) {
			let clientId = roomList[i].clientId;
			if (clientId == this.clientId) continue;
			roomList[i].sendBuf(ActionId.mediaData, data);
		}
	}
	event_leaveRoom() {
		this.close();
	}
	close() {
		// return;
		let roomId = this.roomId;
		this.roomId = null;
		if (!roomId) return;
		let roomList = this.server.rooms[roomId];
		if (!roomList) return;
		if (roomList.length < 2) {
			delete this.server.rooms[roomId];
			return;
		};
		let roomListNew = [];
		for (let i = 0; i < roomList.length; i++) {
			let client = roomList[i];
			if (client === this) continue;
			roomListNew.push(client);
			// client.send({
			// 	eventName: "removePeerConnected",
			// 	clientId: this.clientId,
			// 	userId: this.userId,
			// });
		};
		this.server.rooms[roomId] = roomListNew;
	}
};


// generate a 4 digit hex code randomly
function S4() {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

// https://github.com/webRTC-io/webRTC.io/blob/master/lib/webrtc.io.js#L250
// make a REALLY COMPLICATED AND RANDOM id, kudos to Dennis
function GenID() {
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}