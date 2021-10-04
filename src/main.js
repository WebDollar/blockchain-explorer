console.log("WebDollar explorer server")

const https = require('https')
const http = require('http')

const consts = require('../consts')
const sync = require('./sync')
const db = require('./db/db')
const api = require('./api')
const fs = require('fs')

const express = require('express');
const app = express();
const cors = require('cors')

app.use(cors())

app.get('/', function (req, res) {
    res.send('Hello World');
})

var server

async function callback () {

    var host = server.address().address
    var port = server.address().port
    console.log("Explorer Server listening at http://%s:%s", host, port)

    sync.start()
    api.initialize(app)

}

if (fs.existsSync('certificate.pem')  ){
    const privateKey = fs.readFileSync( 'privatekey.pem' );
    const certificate = fs.readFileSync( 'certificate.pem' );

    server = https.createServer({
        key: privateKey,
        cert: certificate
    }, app).listen(consts.port, callback );

}else {
    server = http.createServer(app).listen(consts.port, callback );
}

