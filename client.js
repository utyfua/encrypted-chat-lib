/*!
 * encrypted-chat-lib
 * @github   https://github.com/utyfua/encrypted-chat-lib#readme
 * @npm      https://www.npmjs.com/package/encrypted-chat-lib
 * @author   utyfua@gmail.com
 * @license  MIT
 */

(() => {
	function blobToArray(blob) {
		const reader = new FileReader();
		let cb, fb;
		let promise = new Promise((c, f) => (cb = c, fb = f));

		function onLoadEnd(e) {
			reader.removeEventListener('loadend', onLoadEnd, false)
			if (e.error) fb(e.error)
			else cb(new Uint8Array(reader.result));
		};

		reader.addEventListener('loadend', onLoadEnd, false)
		reader.readAsArrayBuffer(blob);
		return promise;
	};
	class EventEmitter {
		constructor(args) {
			this._events = {};
			this._events_once = {};
		}
		on(eventName, callback, parent) {
			this._events[eventName] = this._events[eventName] || [];
			this._events[eventName].push(callback);
			if (parent)
				parent._parent_events.push([false, eventName, callback]);
		}
		once(eventName, callback, parent) {
			this._events_once[eventName] = this._events_once[eventName] || [];
			if (parent) {
				let original = callback;
				callback = (...args) => {
					original.apply(this, args);
					parent._parent_events = parent._parent_events.filter(
						line => !(line[0] && line[1] === eventName && line[2] === callback)
					);
				}
			}
			this._events_once[eventName].push(callback);
			if (parent)
				parent._parent_events.push([true, eventName, callback]);
		}
		oncePromice(eventName) {
			return new Promice(callback => this.once(eventName, callback));
		}
		off(eventName, callback) {
			this._events[eventName] = this._events[eventName] &&
				this._events[eventName].filter(func => func !== callback)
			this._events_once[eventName] = this._events_once[eventName] &&
				this._events_once[eventName].filter(func => func !== callback)
		}
		offParent(parent) {
			parent._parent_events = parent._parent_events.filter(([isOnce, eventName, callback]) => {
				let stay = true;
				let key = isOnce ? '_events' : '_events_once';
				if (!this[key][eventName]) return stay;
				this[key][eventName] = this[key][eventName].filter((callback2) => {
					if (callback == callback2) {
						stay = false;
						return false;
					};
					return true;
				});
				return stay;
			});
		}
		emit(eventName, ...args) {
			let count = 0;

			function proc(events) {
				if (!events) return;
				for (let i = 0; i < events.length; i++) {
					events[i].apply(this, args);
					count++;
				};
			}
			proc(this._events[eventName]);
			proc(this._events_once[eventName]);
			delete this._events_once[eventName];
			return count;
		}
	};
	const Buffer = Uint8Array; // madness? i dont think so

	const Proto = {};
	Proto.clientId = [{
		name: 'clientId',
		type: 'string',
	}]
	Proto.user = [
		...Proto.clientId,
		{
			name: 'userId',
			type: 'string',
			optional: true,
		}
	];
	Proto.mediaData = [
		{
			name: 'streamId',
			type: 'string',
		},
		{
			name: 'fp',
			type: 'boolean',
		},
		{
			name: 'type',
			type: 'string',
			encrypt: true,
		},
		{
			name: 'codec',
			type: 'string',
			encrypt: true,
		},
		{
			name: 'data',
			type: 'binary',
			encrypt: true,
		},
	];
	Proto.actions = {
		joinRoom: {
			out: [{
				name: 'roomId',
				type: 'string',
				encrypt: true,
			}],
			in: [
				...Proto.user,
				{
					name: 'connections',
					type: 'array',
					values: Proto.user
				},
			]
		},
		newPeerConnected: {
			in: Proto.user,
		},
		mediaData: {
			out: Proto.mediaData,
			in: [
				...Proto.clientId,
				...Proto.mediaData
			],
		},
	};

	const ActionList = Object.keys(Proto.actions);
	const ActionId = {};
	ActionList.forEach((k, i) => ActionId[k] = i);

	const Convert = {};
	Convert._enc = new TextEncoder();
	Convert._dec = new TextDecoder();
	Convert.int32ToBytes = function int32ToBytes(num) {
		let arr = new ArrayBuffer(4); // an Int32 takes 4 bytes
		let view = new DataView(arr);
		view.setUint32(0, num, false); // byteOffset = 0; litteEndian = false
		return new Uint8Array(arr);
	};
	Convert.bytesToInt32 = function bytesToInt32(buf) {
		// ¯\_(ツ)_/¯
		return buf[3] +
			buf[2] * 256 +
			buf[1] * 256 * 256 +
			buf[0] * 256 * 256 * 256
	};
	Convert.bufferifyHelper = function bufferifyHelper({ out, data, proto }) {
		for (let i = 0; i < proto.length; i++) {
			let { name, type, encrypt, optional, values } = proto[i];
			if (type == 'boolean') {
				out.push(Uint8Array.from([data[name] ? 1 : 0]))
				continue;
			};
			if (!(name in data)) {
				if (!optional) throw new Error('Broken data[' + name + ']');
				out.push(this.int32ToBytes(0));
				continue;
			};
			if (type == 'string') {
				let buf = this._enc.encode(data[name]);
				out.push(this.int32ToBytes(buf.length));
				out.push(buf);
				continue;
			};
			if (type == 'array') {
				out.push(this.int32ToBytes(data[name].length));
				for (let o = 0; o < data[name].length; o++)
					this.bufferifyHelper({ out, data: data[name][o], proto: values });
				continue;
			};
			if (type == 'binary') {
				out.push(this.int32ToBytes(data[name].length));
				out.push(Uint8Array.from(data[name]));
				continue;
			};
			console.log(out);
			throw 'cant handle ' + name + ':' + type + ' type';
		}
	};
	Convert.bufferify = function bufferify(action, data, direct) {
		let out = [Uint8Array.from([action])];
		let proto = Proto.actions[ActionList[action]][direct];
		this.bufferifyHelper({ out, data, proto });
		let offset = out.reduce((length, arr) => length + arr.length, 0);
		let merged = new Uint8Array(offset);
		offset = 0;
		out.forEach(arr => {
			merged.set(arr, offset);
			offset += arr.length;
		});
		return merged;
	};
	Convert.bufferParseHelper = function bufferParseHelper({ offset, buf, proto }) {
		let data = {};
		for (let i = 0; i < proto.length; i++) {
			let { name, type, encrypt, optional, values } = proto[i];
			if (type == 'boolean') {
				data[name] = !!buf[offset];
				offset += 1;
				continue;
			};
			let length = this.bytesToInt32(buf.slice(offset, offset += 4));
			if (type == 'string') {
				if (!length) continue;
				data[name] = this._dec.decode(buf.slice(offset, offset += length));
				continue;
			};
			if (type == 'array') {
				data[name] = [];
				for (let o = 0; o < length; o++) {
					let res = this.bufferParseHelper({ offset, buf, proto: values });
					data[name].push(res[0]);
					offset = res[1];
				};
				continue;
			};
			if (type == 'binary') {
				data[name] = buf.slice(offset, offset += length)
				continue;
			};
			throw 'cant handle ' + name + ':' + type + ' type';
		}
		return [data, offset];
	};
	Convert.bufferParse = function bufferParse(buf, direct) {
		let action = buf[0];
		let proto = Proto.actions[ActionList[action]][direct];
		let offset = 1;
		let [data] = this.bufferParseHelper({ offset, buf, proto });
		return { action, data };
	};

	class EncryptedChatLib extends EventEmitter {
		constructor(args) {
			super();
			this.args = args;
			this.localStreams = [];
			this.sendQueue = [];
			this.clients = [];
			this.password = 'none';
			// this.Buffer = Buffer;
			// this.ActionList = ActionList;
		}

		// encrypt functions & setters
		encode(data) {
			return Uint8Array.from(data);
		}
		setEncode(f) {
			this.encode = f;
		}
		decode(data) {
			return data;
		}
		setDecode(f) {
			this.decode = f;
		}

		bufferify(action, data) {
			return Convert.bufferify(action, data, 'out');
			return Buffer.from([action, ...new TextEncoder("utf-8").encode(JSON.stringify(data))]);
		}
		async bufferParse(data) {
			data = await blobToArray(data);
			return Convert.bufferParse(data, 'in');
			return {
				action: data[0],
				data: JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(data.slice(1)))),
			};
		}

		setConnect(send) {
			this.send = send;
			this.emit('connect');
			return (data) => this.receive(data);
		}
		async sendBuf(action, data) {
			if (this.sendQueueUsed)
				return this.sendQueue.push([action, data]);
			if (data.data instanceof Promise) {
				this.sendQueueUsed = 1;
				data.data = await data.data;
			}
			this.send(this.bufferify(action, data));
			if (this.sendQueueUsed) {
				this.sendQueueUsed = false;
				let queue = this.sendQueue;
				this.sendQueue = [];
				queue.forEach((...a) => this.sendBuf(...a))
			}
		}
		async receive(data) {
			data = await this.bufferParse(data);
			if (ActionList[data.action] && this['action_' + ActionList[data.action]])
				this['action_' + ActionList[data.action]](data.data);
			else console.log('receive', data)
		}

		joinRoom(roomId = "default", password) {
			if (password) this.password = password;
			this.sendBuf(ActionId.joinRoom, {
				roomId: roomId + ':' + this.password,
			});
		}
		// events handlers
		action_joinRoom(data) {
			// this.action_leaveRoom();
			this.clientId = data.clientId;
			this.userId = data.userId;
			this.roomId = data.roomId;
			data.connections.forEach(data => {
				this.action_newPeerConnected(data, this);
				this.emit('newPeerConnected', data);
			});
		}
		action_newPeerConnected(data) {
			this.clients.push(data);
			if (data.initSegments)
				data.initSegments.map(this.action_mediaData.bind(this));
		}
		getClient(clientId) {
			return this.clients.find(client => client.clientId == clientId);
		}

		async action_mediaData(data) {
			// mediaSource.endOfStream();
			let client = this.getClient(data.clientId);
			if (!client) return console.log('bad client', data, this);
			if (!client.media) client.media = {};
			let mediaSource = client.media[data.streamId];
			if (!mediaSource) {
				if (!data.fp) return;
				mediaSource = client.media[data.streamId] = new MediaSource();
				mediaSource.cache = [];
				// mediaSource.cache = data.data;
				// data.data = [];
				// let src = URL.createObjectURL(mediaSource);
				this.emit('addedRemoteStream', mediaSource, data.type, client.clientId, client.userId);
				await new Promise(c => mediaSource.addEventListener('sourceopen', c));
				let sourceBuffer = mediaSource.sourceBuffer = mediaSource.addSourceBuffer(data.codec);
				sourceBuffer.mode = "sequence";

				// sourceBuffer.onupdate = ev => console.info("update", ev);
				sourceBuffer.onabort = ev => console.warn("ABORT", ev);
				sourceBuffer.onerror = ev => console.error("ERROR", ev);
				// console.log(mediaSource.sourceBuffer)
				// return;
			};
			// if (mediaSource.readyState == "closed") return console.log('closed');
			let sourceBuffer = mediaSource.sourceBuffer;
			let buffer = [...mediaSource.cache, ...data.data];
			if (!sourceBuffer || sourceBuffer.updating) {
				mediaSource.cache = buffer;
				return;
			};
			try {
				sourceBuffer.appendBuffer(Buffer.from(buffer));
			} catch (e) {
				console.log('we a fuck', e)
				this.emit('removedRemoteStream', mediaSource, data.type, client.clientId, client.userId);
				delete client.media[data.streamId];
			}
		}


		setMedia(data) {
			if (typeof data == 'string') data = {
				type: data
			};
			let {
				type,
				enable,
				args
			} = data;
			let stream = this.getMedia(type);
			if (typeof enable === 'undefined') enable = !stream;
			if (stream)
				return !enable && this.removeLocalStream(stream, true);
			if (!enable) return;
			this.createStream({
				type,
				args
			});
		}
		getMedia(type) {
			return this.localStreams.find(stream => stream._type == type)
		}
		async createStream({
			type,
			args
		}) {
			if (['display', 'video', 'audio'].indexOf(type) === -1)
				throw new Error('media bad type - ' + type);
			let mediaFunc = type === 'display' ? 'getDisplayMedia' : 'getUserMedia';
			let opts = type == 'display' ? {} : {
				[type]: args || true,
			};
			let stream;
			try {
				stream = await navigator.mediaDevices[mediaFunc](opts);
			} catch (e) {
				this.emit('rejectUseMedia', type);
				return;
			}
			stream._type = type;
			this.addLocalStream(stream);
		};
		addLocalStream(stream) {
			this.localStreams.push(stream);
			this.emit('addedLocalStream', stream, stream._type);
			this.initRecoder(stream);
		}
		initRecoder(stream) {
			let rec = stream.rec = new MediaRecorder(stream
				// , { mimeType: "audio/webm;codecs=opus" }
			);
			rec.ondataavailable = async e => {
				let data = await blobToArray(e.data);
				this.sendBuf(ActionId.mediaData, {
					streamId: stream.id,
					fp,
					type: stream._type,
					codec: e.data.type,
					data,
				});
				fp = false;
			};
			let fp = true;
			rec.start(100);
			setTimeout(() => {
				rec.stop();
				this.initRecoder(stream);
			}, 2000);
		}
		removeLocalStream(stream, needStop) {
			if (needStop) stream.getTracks()[0].stop();
			this.localStreams = this.localStreams.filter(local => local !== stream);
			this.emit('removedLocalStream', stream, stream._type);
		}
	};

	// EncryptedChatLib.Buffer = Buffer;
	EncryptedChatLib.Proto = Proto;
	EncryptedChatLib.ActionList = ActionList;
	EncryptedChatLib.ActionId = ActionId;
	EncryptedChatLib.Convert = Convert;

	if (typeof module === 'object')
		module.exports = EncryptedChatLib;
	else
		window.EncryptedChatLib = EncryptedChatLib;
})();