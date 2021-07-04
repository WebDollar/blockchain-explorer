console.log("WebDollar explorer server")

const consts = require('../consts')
const sync = require('./sync')
const db = require('./db/db')
const api = require('./api')

var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send('Hello World');
})

var server = app.listen( consts.port, async function () {

    var host = server.address().address
    var port = server.address().port
    console.log("Explorer Server listening at http://%s:%s", host, port)

    sync.start()
    api.initialize(app)
})
