const app = require('express')();
const server = require('http').createServer(app);
const WebSocketServer = require('ws').Server;

// require lib
// const Voicer = require('webrtc-unified/server');
// its package repository, require local file
const Voicer = require('./server.js');
// create server instance
const voicer = Voicer();

server.listen(process.env.PORT || 3479 || 3000, '0.0.0.0');

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

['client.js', 'client-demo.js'].forEach(file =>
	app.get('/' + file, function (req, res) {
		res.sendFile(__dirname + '/' + file);
	})
);
let wss = (new WebSocketServer({
	path: '/ws',
	server,
}));

wss.on('connection', onClient);

// example connection event handler
function onClient(ws, req) {
	// create client instance
	// you can put off initializing client instance before getting data for this package
	ws.voicer = voicer.addClient({
		send: data => ws.send(data),
	});
	// we get some data from client
	ws.on('message', mess => {
		ws.voicer.receive(mess);
	});
	// when connection closed, use close for disconnect this user from other and destroy client instance
	ws.on('close', function () {
		ws.voicer.close();
		ws.voicer = undefined;
	});
}