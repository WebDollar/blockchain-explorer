# blockchain-explorer
A simple blockchain explorer

# Installing tutorial

# Installing a full node. Use branch `disable-wallet` https://github.com/WebDollar/Node-WebDollar/tree/disable-wallet

Edit `src/node/sockets/node-server/API-router/Node-API-Router.js`

Replace

    if (process.env.WALLET_SECRET_URL && typeof process.env.WALLET_SECRET_URL === "string" && process.env.WALLET_SECRET_URL.length >= 30) {
        this._addRoute( process.env.WALLET_SECRET_URL+'/blocks_complete/at/:block', NodeAPIPublicBlocks.blockComplete, nodeApiType, 100, app, prefix, middleWare );
    }
    
Replace with 

    if (1 === 1) {
        this._addRoute( 'SECRET_SECRET_SECRET_LONG_SECRET/blocks_complete/at/:block', NodeAPIPublicBlocks.blockComplete, nodeApiType, 100, app, prefix, middleWare );
    }

Define in consts.js 
    
    fallback: "http://full_node:port"
    fallbackSecret: "SECRET_SECRET_SECRET_LONG_SECRET"    


## Deleting old databases

`
$ mongo
$ show dbs
$ use explorerdb
$ db.dropDatabase
`

## 
