// its client-demo.js file in package

// ignore this file if you include client.js file early
// const EncryptedChatLib = require('encrypted-chat-lib/client');
let chat = new EncryptedChatLib();

//  use string type for all data
chat.useStringMode(true);

// chat.setEncode((data, pass, oneWay) => {
// 	return chat.Buffer.from(data);
// });
// chat.setDecode((data, pass) => {
// 	return data;
// });

// create connection with our server
var socket = new WebSocket('ws' + location.origin.slice(4) + '/ws');

// function to send data to the server
function func_send(data) {
	socket.send(data);
};
// reload page if connection lost
socket.onclose = function () {
	location.reload();
};

// get a messages handler function
let conn_handler = chat.setConnect(func_send);

// handle socket a connected state
socket.onopen = function () {
	// join to default room
	chat.joinRoom('default');
};

// handle messages
socket.onmessage = function (msg) {
	conn_handler(msg.data);
};

// bind actions
butt_micro.onclick = function () {
	if (this.innerHTML == 'Enable micro') {
		chat.setMedia({
			type: 'audio',
			enable: true,
		});
		this.innerHTML = 'Mute micro';
	} else {
		chat.setMedia({
			type: 'audio',
			enable: false,
		});
		this.innerHTML = 'Enable micro';
	}
}
// butt_micro.onclick();
butt_cam.onclick = function () {
	if (this.innerHTML == 'Enable cam') {
		chat.setMedia({
			type: 'video',
			enable: true,
		});
		this.innerHTML = 'Disable cam';
	} else {
		chat.setMedia({
			type: 'video',
			enable: false,
		});
		this.innerHTML = 'Enable cam';
	}
}
butt_screen.onclick = function () {
	if (this.innerHTML == 'Enable screen') {
		chat.setMedia({
			type: 'display',
			enable: true,
		});
		this.innerHTML = 'Disable screen';
	} else {
		chat.setMedia({
			type: 'display',
			enable: false,
		});
		this.innerHTML = 'Enable screen';
	}
};

// user reject request to use audio/video/screen
chat.on('rejectUseMedia', function (media_type) {
	alert('reject request to use ' + media_type);
});

// handle local stream for draw
chat.on('addedLocalStream', function (stream, media_type) {
	// ignore voice
	if (media_type == 'audio') return;
	// ignore screen
	if (media_type == 'screen' && you.srcObject) return;
	you.srcObject = stream;
	you.play();
});

// handle local stream for remove
chat.on('removedLocalStream', function (stream, media_type) {
	// ignore voice
	if (media_type == 'audio') return;
	you.srcObject = undefined;
});

// handle remote stream for draw
chat.on('addedRemoteStream', function (stream, media_type, clientId) {
	// media_type - screen accepted as video on remote client
	// but just in case screen type check
	var tag = media_type === 'screen' ? 'video' : media_type;
	var remote = document.createElement(tag);
	document.body.appendChild(remote);
	remote.volume = 1;
	remote.controls = 1;
	remote.autoplay = 1;
	// remote.srcObject = stream;
	remote.src = URL.createObjectURL(stream);
	// remote.play();
	remote.dataset.clientId = clientId;
	// remote.addEventListener('error', function (e) {
	// 	console.log(e);
	// });
});

// handle remote stream for remove
chat.on('removedRemoteStream', function (stream, media_type, clientId) {
	let mediaList = document.querySelectorAll('[data-client-id="' + clientId + '"]');
	for (let i = 0; i < mediaList.length; i++)
		if (mediaList[i].srcObject === stream)
			mediaList[i].remove();
});

// window.addEventListener('unhandledrejection', function(event) {
//   // the event object has two special properties:
//   console.log(event.promise, event.reason); 
// });